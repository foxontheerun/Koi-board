# Koi: performance and accessibility audit

Measured 5 August 2026. Every number below comes from a file in this
directory, and every file was produced by a script in `client/perf/`.

---

## 1. What was measured, and on what

**The app.** Koi is a Vite + React 19 SPA. Its landing route is a login form;
its product is a board rendered by a hand-written Canvas engine behind auth.
Those two routes have almost nothing in common, so they are measured
separately and never averaged.

| | |
|---|---|
| URLs | `/login` and `/:boardId` |
| Board contents | 400 shapes: 155 rectangles, 104 ellipses, 102 stickers with text, 39 standalone text blocks, spread over 2400 x 1600 world units. The camera loads at identity, so roughly a third are on screen at once. |
| Build | production (`vite build`), served by `vite preview`. Never the dev server. |
| Runs | 3 per cell, median reported, individual runs kept |
| Presets | Lighthouse mobile (the default, 4x CPU throttle, simulated slow 4G) and `desktop` |
| Machine | AMD Ryzen 5 5600U, 6 cores / 12 threads, 31 GB RAM, Windows 11 Pro 10.0.26200 |
| Tools | Lighthouse 13.4.1, axe-core 4.12.1, Chrome 150.0.7871.187, Playwright 1.61.1, Node 24.12.0 |
| Backend | Go + Postgres 17, both local |

**Getting Lighthouse onto an authenticated board.** Lighthouse has no idea how
to log in. The runner (`client/perf/lighthouse-run.mjs`) launches a real
Chrome through `chrome-launcher`, connects over CDP, writes the refresh token
into `localStorage` on a static asset URL, and runs Lighthouse against that
profile with `disableStorageReset`.

That flag has a trap worth naming, because the first version of this audit
fell into it: `disableStorageReset` preserves the HTTP cache as well as
storage, so the seeding navigation warmed the cache and the board was being
measured warm while the login page was measured cold. The board looked 4x
faster than it was. The runner now clears the cache over CDP after seeding,
and the seeding navigation loads `/vite.svg` rather than the app.

**Two things that flatter these numbers, stated up front.** The API is on
`localhost`, so the board's data fetch carries no real network latency; and a
local `.env` sets `VITE_DEV_NO_AUTH=1`, which would have measured a build
that skips the login screen entirely. `client/perf/build.mjs` pins that off
for every measured build.

**Reproducing.** Start Postgres and the API, letting the API accept both
preview origins:

```
DB_PORT=5433 docker compose up -d db
cd server && DATABASE_URL=postgres://koi:koi@localhost:5433/koi?sslmode=disable \
  ALLOWED_ORIGINS=http://localhost:4173,http://localhost:4174 go run ./cmd/api
```

Then from `client/`:

```
npm run perf:seed          # 400 shapes on a fresh board, deterministic
npm run perf:build         # dist (measured), dist-perf (A/B arm), dist-map (sourcemaps)
npx vite preview --port 4173                        # serves dist
npx vite preview --outDir dist-perf --port 4174     # serves dist-perf

PERF_LABEL=mine npm run perf:lighthouse    # against 4173
PERF_LABEL=mine npm run perf:a11y          # against 4173
PERF_LABEL=mine npm run perf:interaction   # against 4174
PERF_LABEL=mine npm run perf:bundle        # reads dist-map
```

`perf:seed` writes `client/perf/session.json` (board id + refresh token);
it is gitignored, and every other script reads the board from it.

---

## 2. Baseline

`lighthouse/baseline/` — medians of 3.

| | perf | a11y | FCP | LCP | TBT | CLS | Speed Index |
|---|---|---|---|---|---|---|---|
| login mobile | 73 | 82 | 4049 ms | 4504 ms | 57 ms | 0 | 4049 ms |
| login desktop | 71 | 82 | 2571 ms | 2571 ms | 0 ms | 0 | 2571 ms |
| board mobile | 62 | 77 | 2324 ms | 4350 ms | 611 ms | 0.068 | 2562 ms |
| board desktop | 93 | 79 | 563 ms | 986 ms | 177 ms | 0.041 | 1014 ms |

Targets for reference: LCP <= 2.5 s, TBT <= 200 ms, CLS <= 0.1, FCP <= 1.8 s.
Three of the four cells missed LCP; the board missed TBT on mobile by 3x.

Transferred: 284 kB on login, 455 kB on the board, of which 206 kB was
JavaScript — **one chunk, on every route**.

### Bundle composition

`bundle/baseline.json`, attributed by walking the sourcemap
(`client/perf/bundle.mjs` — no extra dependency for a number read once).

| | bytes | share |
|---|---|---|
| react-dom | 181,594 | 27.9% |
| @apollo/client | 97,913 | 15.1% |
| **lodash** | **72,822** | **11.2%** |
| src/canvas | 52,624 | 8.1% |
| graphql | 42,623 | 6.6% |
| react-router | 32,789 | 5.0% |
| rxjs | 23,880 | 3.7% |
| **react-draggable + re-resizable + react-rnd** | **47,670** | **7.3%** |
| lucide-react | 6,857 | 1.1% |

Two of those are mistakes rather than costs. `lodash` is 11% of the bundle for
one call to `throttle`. The `react-rnd` trio belongs to
`ResizableDraggableShape`, the DOM-based shape from before the canvas engine
existed; nothing referenced it, but it was re-exported from a barrel that is
imported for its types, so it shipped in every build.

`lucide-react` at 1.1% is the interesting negative result: barrel imports
from icon libraries are the classic silent regression, and here tree-shaking
is doing its job.

---

## 3. What Lighthouse cannot see

Lighthouse measures page load. Koi's actual engineering — dirty-rect
invalidation, the `DOMMatrix` camera, layer separation between the static
canvas and the drag canvas — lives entirely in interaction, after load, and
no Lighthouse number touches it. INP is not produced in a lab run at all.

So interaction is measured separately, and this is the more interesting half.

**Method** (`client/perf/interaction.mjs`). Playwright opens the seeded board
at 1440 x 900, grabs a shape at (700, 430) and drags it 80 steps to
(380, 700), across the dense middle of the board. Two numbers are collected
per drag:

- **render time** — the wall-clock cost of `dragLayer()` + `overlay()` inside
  the pointer-move handler. Rendering here is synchronous inside the event,
  so this is the renderer's own cost, uncontaminated by anything else.
- **frame interval** — a `requestAnimationFrame` sampler running through the
  drag; what the user actually sees.

5 trials plus a discarded warm-up, median of the per-trial percentiles, 80
render samples per trial. The drag deliberately never releases the mouse:
mouse-up is what persists the move, and a board that drifts between trials is
a board where trial 5 is not measuring what trial 1 measured.

The A/B arm is the point. With `window.__koiPerf.naive` set, `RenderManager`
repaints **every shape on the main canvas on every pointer move** — no
lifting onto the drag layer, no clipping, no partial clears. That is what the
renderer would be without the invalidation strategy. The arm is compiled in
only when the bundle is built with `VITE_PERF=1`; the measured production
build contains none of it, which `grep __koiPerf dist/assets/*.js` confirms.

### Result, 400 shapes

`interaction/after.json`.

| | render p50 | render p95 | frame p50 | frame p95 |
|---|---|---|---|---|
| dirty rects, CPU 1x | **0.85 ms** | **1.20 ms** | 16.7 ms | 16.8 ms |
| no dirty rects, CPU 1x | 3.80 ms | 4.81 ms | 16.7 ms | 16.7 ms |
| dirty rects, CPU 4x | **4.70 ms** | **6.61 ms** | 16.7 ms | 16.8 ms |
| no dirty rects, CPU 4x | 24.50 ms | 39.02 ms | 16.7 ms | **166.6 ms** |

Dirty-rect invalidation is worth **4.5x at p50 and 4.0x at p95** on this
hardware, and **5.2x / 5.9x** once the CPU is throttled 4x to something like
a mid-range laptop.

The frame column is where it stops being an abstraction. With invalidation
on, the drag holds a 16.7 ms frame at both throttle levels — the p95 never
moves. With it off at 4x, the p95 frame interval is **166.6 ms**: ten frames
dropped in a row, which is not a slow drag, it is a stuck one.

The equivalent baseline run (`interaction/baseline.json`) reads 0.90 / 1.30
and 25.90 / 42.51 — the same shape, so the two runs also serve as each
other's repeatability check. None of the load-time fixes touched the
renderer, and the numbers agree.

---

## 4. What was fixed, and what each fix moved

One commit per fix, each with its before/after in the commit message and its
artefacts in this directory.

### Fix 1 — stop shipping lodash and a dead component

`import { throttle } from "lodash"` became `lodash/throttle`;
`ResizableDraggableShape` and `react-rnd` were deleted.

JS transferred **206.0 kB -> 165.2 kB (-19.8%)**. LCP: login mobile
4504 -> 4033 ms, board mobile 4350 -> 4019 ms, board desktop 986 -> 915 ms.
Performance 73/71/62/93 -> 77/72/68/95.

### Fix 2 — route-level code splitting: tried, measured, reverted

`React.lazy` on `/:id`, `/` and `/signup`. It is the first item on every
checklist, and here it is a trade, not a win:

| | FCP | LCP |
|---|---|---|
| login mobile | 4033 -> 3594 ms | 4033 -> 3704 ms |
| login desktop | 2561 -> 2543 ms | 2561 -> 2543 ms |
| board mobile | 2173 -> 2017 ms | 4019 -> **4230 ms** |
| board desktop | 552 -> 512 ms | 915 -> **1025 ms** |

The login page loses 110 kB it never runs; the board pays for a second
request in series and loses ~110 ms desktop, ~210 ms mobile. Starting the
chunk import from the entry module so it runs beside the auth refresh rather
than behind it moved nothing (measured, twice).

Reverted. The board is the product, its LCP is the worst number in this
report, and the gain lands on a login form. Recovering both sides would need
per-route `modulepreload` hints from the server, which is a deployment
concern rather than a code one. Artefacts kept in
`lighthouse/fix2-code-splitting/` so the trade-off does not have to be
re-measured to be argued about.

### Fix 3 — serve the fonts from our own origin

The Google Fonts stylesheet was a render-blocking request to a third origin,
328 ms of the critical path by Lighthouse's own accounting. The five woff2
files it ended up fetching are vendored under `client/public/fonts` with our
own `@font-face` rules; the body font is preloaded; the unused weight 800 is
gone.

This is the single largest change in the report:

| | perf | FCP | LCP |
|---|---|---|---|
| login mobile | 77 -> 95 | 4033 -> 2060 ms | 4033 -> 2360 ms |
| login desktop | 72 -> **100** | 2561 -> **500 ms** | 2561 -> **580 ms** |
| board mobile | 68 -> 70 | 2173 -> 1668 ms | 4019 -> 3686 ms |
| board desktop | 95 -> 97 | 552 -> 426 ms | 915 -> 846 ms |

**A correction.** The commit for this change credits it with taking the
board's mobile CLS from 0.068 to 0. That claim does not survive the control
run in section 6: mobile CLS is intermittent and reads 0.068 in some runs of
the unchanged baseline build too. Fix 4 is what removed it. Fonts moved LCP,
not CLS.

### Fix 4 — hold the top bar's height open

`TopBar` only renders once `BoardCanvas` hands back a camera, so the canvas
column started at the full viewport height and was pushed down 56 px a frame
later.

CLS on board desktop was **0.041 in every one of the twelve runs** across
baseline, fix 1, fix 3 and the control, and **0 in every run after**. Board
mobile, where the same shift was sampled intermittently, is 0 in every run
after. Nothing else in the audit is this deterministic.

### Fix 5 — accessibility

Section 7.

---

## 5. After

`lighthouse/after/` — medians of 3, same method, same board.

| | perf | a11y | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|
| login mobile | **95** (73) | **100** (82) | **2010** (4049) | **2310** (4504) | 121 (57) | 0 (0) |
| login desktop | **100** (71) | **100** (82) | **500** (2571) | **580** (2571) | 0 (0) | 0 (0) |
| board mobile | 66 (62) | **95** (77) | 1730 (2324) | **3673** (4350) | 1041 (611) | **0** (0.068) |
| board desktop | **96** (93) | **100** (79) | **444** (563) | **832** (986) | 150 (177) | **0** (0.041) |

Baseline in brackets. Transferred: login 284 -> 242 kB, board 455 -> 413 kB.

Both login cells now meet every Core Web Vitals target. Board desktop meets
all of them. **Board mobile still misses LCP by 1.2 s**, and that is the
honest headline: the audit did not fix the board's mobile load, it improved
it by 677 ms and moved the bottleneck somewhere visible.

Where it is now: the board's own data. On the board route the largest single
transfer is **149 kB of GraphQL response** for 400 shapes — bigger than the
whole JavaScript bundle. That is the next thing to attack, and it is a
backend-shaped problem (pagination, viewport-bounded queries, a leaner shape
payload), not a bundler-shaped one.

---

## 6. What the numbers are worth: a control run

Board mobile TBT reads 611 ms in the baseline and 1041 ms after, which looks
like a serious regression. It is not.

`lighthouse/control-baseline-rerun/` is the **baseline build measured again
an hour later**, byte-identical bundle, same board, same machine:

| board mobile | baseline | control (same bytes) | after |
|---|---|---|---|
| LCP | 4350 ms | 4369 ms | 3673 ms |
| FCP | 2324 ms | 3207 ms | 1730 ms |
| TBT | 611 ms | 832 ms | 1041 ms |
| individual TBT runs | 824/611/605 | 763/1102/832 | 1041/1178/975 |

On unchanged code, mobile TBT moved 611 -> 832 ms and FCP moved
2324 -> 3207 ms. Neither is quotable on this machine to better than its drift
band, so this report does not quote them as improvements or regressions.
Mobile LCP came back 4350 vs 4369 — 0.4% — and is quotable. Board desktop was
stable throughout (LCP 986 / 1000 / 832).

Running the control at all is the part worth keeping: a 3-run median looks
authoritative and hides this completely.

---

## 7. Accessibility

### Automated

`a11y/baseline.json` and `a11y/fix5-a11y.json`: axe-core over five states —
login, board list, idle board, open colour picker, open selection toolbar —
plus a scripted keyboard walk.

Baseline, 4 violation types over 16 nodes:

| rule | impact | what |
|---|---|---|
| `button-name` | critical | undo, redo and both zoom buttons were icon-only with no accessible name |
| `label` | critical | the board title input had no label of any kind |
| `color-contrast` | serious | white on `#16B8D4` is **2.37:1** on every primary button; muted text on the board list `#8A8A8A` on `#F5F5F5` is 3.16:1 |
| `region` / `landmark-one-main` | moderate | no landmarks on any screen |

Plus one axe cannot see: the auth inputs carried `outline-none` and signalled
focus by swapping a 1 px border to a colour **1.89:1** against the old one —
below the 3:1 a focus indicator needs. Seven other controls fell back to the
browser's default ring, which is drawn in `currentColor`, so on the active
aqua tool button it was white on aqua.

After: **zero violations in all five states**, and all 15 focusable controls
draw the same 2 px `#0E7C99` ring. Lighthouse accessibility 82 -> 100 on
login and 79 -> 100 on board desktop.

One node survives, on board mobile only (95, not 100): at a 412 px viewport
the top bar overflows and the user email lands on the `#111827` body
background at 3.08:1. That is a responsive layout bug — the bar has no
mobile treatment at all — not a palette one, and it is left for its own
change rather than papered over by recolouring the text.

### Manual: the canvas

This is where the real answer is, and it is not a score.

- The board is four `<canvas>` elements. All four have `tabindex="-1"`, no
  `role`, no `aria-label`, no fallback content.
- The tab ring is 15 stops long and every one is chrome: title, undo, redo,
  zoom out, zoom in, share, log out, seven tools, display name. Then focus
  leaves the document. **The canvas is never reachable.**
- There are **zero** live regions. Nothing that happens on the board is
  announced.
- There is no global key handler at all: no `Delete` to remove a selection,
  no arrows to nudge, no `Escape`. Every board operation requires a pointer.

Canvas is inherently opaque to assistive technology — shapes are pixels, not
nodes — and that is the interesting answer rather than a failure to hide.
What a canvas app can realistically offer is three things:

1. **A focusable canvas with a documented keyboard model.** `tabindex="0"`,
   `role="application"` so the screen reader hands arrow keys through, and an
   `aria-describedby` that states the keys. `role="application"` is only
   defensible next to point 3.
2. **An ARIA live region for state changes** — "rectangle selected", "3
   shapes selected", "moved 10 pixels right" — emitted where state changes,
   and throttled the way cursor updates already are.
3. **A DOM-based object list as an alternative view**: every shape in paint
   order, each row a button that selects and centres it. This is the piece
   that makes the board inspectable at all, and it is plainly useful with a
   mouse too, which is how a feature like this survives.

Koi has none of the three. The design is written up in
`docs/tasks/canvas-keyboard-model.md`, sequenced so that step 1 alone — a
focusable canvas that announces the selection — delivers most of the value.

What was fixed here was deliberately only the cheap and real part: names,
labels, contrast, focus visibility, landmarks. A keyboard model for the
canvas is a feature, and pretending otherwise would have been the dishonest
version of this section.

---

## 8. Lab, not field

Everything above is a Lighthouse **lab** measurement under simulated
throttling on one developer laptop, with the API on `localhost`. It is not
real-user data. Real Core Web Vitals would come from RUM — `web-vitals` in
the client reporting LCP, CLS and INP from actual sessions — and would differ,
particularly for INP, which a lab run does not produce at all and which is
exactly where a canvas app's cost lives.

---

## 9. Four sentences, each traceable to a number above

- Dirty-rect invalidation in Koi's canvas renderer is worth **4.5x at p50 and
  4.0x at p95** on drag frame cost against a full-repaint baseline at 400
  shapes, and **5.2x / 5.9x** at a 4x CPU throttle; without it the p95 frame
  interval goes from 16.7 ms to **166.6 ms**, which is ten dropped frames in
  a row. (Section 3.)

- I audited the app with Lighthouse and took the login route from **73/71 to
  95/100** and board desktop from 93 to 96, the largest single win being
  moving Google Fonts off the critical path — **LCP 2571 -> 580 ms on
  desktop** — and I reverted route-level code splitting after measuring that
  it cost the board 110 ms of LCP to save the login page 330 ms. (Sections 4
  and 5.)

- I re-measured the unchanged baseline build an hour later and found mobile
  TBT drifting **611 -> 832 ms** and FCP **2324 -> 3207 ms** on identical
  bytes, so I report mobile LCP (stable to 0.4%) and don't report mobile TBT
  as a result at all. (Section 6.)

- axe-core found four violation types over sixteen nodes — including a
  primary button at **2.37:1** and four unnamed icon buttons — now zero
  across five screens; the harder finding is that the canvas itself is
  unreachable by keyboard and announces nothing, which is a feature to build
  rather than a rule to satisfy, and I've specified it. (Section 7.)
