# Koi

![demo](https://github.com/user-attachments/assets/3afe6093-203f-4352-98d6-b9845063672f)

**A real-time collaborative whiteboard with a custom Canvas rendering engine and
multi-user synchronization.** Multiple people edit the same board at once — shapes,
selection, layers — with live cursors and conflict handling, rendered on a
hand-written Canvas engine (no rendering library).

Frontend: React + Vite + TypeScript. Backend: Go + GraphQL (gqlgen) with
WebSocket subscriptions and Postgres persistence.

> Under active development — API and structure may change.

---

## Features

- **Custom Canvas rendering engine** — multi-layer, no rendering library
- **Real-time collaboration** — multiple users on one board, live cursors, soft-locks
- Shapes: rectangles, ellipses, sticky notes, standalone text blocks
- **Rich text** — wrapped and painted by a hand-written layout engine; size,
  weight and colour apply to the selected range, or to the whole block when
  nothing is selected
- Move, resize (zoom-aware handles), pan, zoom-around-cursor
- **Selection system** — click, drag-select, Shift to extend, single group frame,
  **group resize** (scale the whole selection proportionally)
- Layer order (front / back / forward / backward), lock / unlock
- Right-click context menu + floating selection toolbar
- **Accounts** — email + password sign-in (JWT), verified on both HTTP and the WebSocket
- **Boards per user** — your own boards, shared by link (open a board's URL to join)
- **Persistence** — users, boards and shapes stored in Postgres

---

## Architecture

### Rendering

Four independent canvas layers, each with its own repaint logic:

| Layer                | Redraws on                                                |
| -------------------- | --------------------------------------------------------- |
| grid                 | zoom / pan                                                |
| main (static shapes) | shape added / removed / settled                           |
| drag                 | every frame while dragging/resizing — one shape at a time |
| overlay              | selection frames, handles, previews, remote cursors       |

The expensive layer (main) barely repaints; the cheap one (drag) repaints
constantly but only the moving shapes. **Dirty-rect** clipping limits each redraw
to the changed region (`computeShapesBoundingRect` + `ctx.clip`), so moving one
shape among hundreds touches a few thousand pixels, not the whole canvas.

Two rules keep that honest. **No shape is painted on two canvases at once**: a
dragged shape and every neighbour the region touches are lifted onto the drag
layer, and the static layer skips them — otherwise their semi-transparent
shadows composite with themselves. And **a clipped shape is never drawn
partially**, so the region is closed under intersection: any neighbour it touches
joins and widens it until it stops growing.

### Text

Text is a shape, laid out by the same engine that draws it. Wrapping breaks on
words, splits an oversized one by grapheme, and handles a line of mixed sizes:
each line takes its height from its tallest segment and every segment sits on one
shared baseline. Editing happens in a DOM overlay that scales with the camera and
matches the canvas metrics exactly — the painter reproduces the half-leading CSS
adds, or text would jump when editing ends.

The camera uses **`DOMMatrix`** with a cached inverse for screen↔world transforms
and zoom-around-cursor.

### Runtime — facade + controllers

`BoardRuntime` is a thin **facade** that constructs and wires the pieces and
delegates; the logic lives in focused controllers, each injected only with what
it needs:

- `RenderOrchestrator` — wraps the repeated draw calls
- `CollabController` — lock + presence orchestration and the periodic sweep
- `ShapeCreationController` — creation tool, preview, finish
- `ShapeCommands` — z-order / lock / delete / text
- `PointerController` — pointer routing (down/move/up, pan)

The canvas logic is decoupled from React (`BoardRuntime` has no DOM/React
dependency), and the pure pieces take time as a parameter, so they're
deterministically unit-tested.

### Collaboration

Changes sync over GraphQL subscriptions (WebSocket). The server keeps per-board
pub/sub channels for shape events, transient moves, locks and cursors; each client
ignores its own echoes via a `clientID` guard.

### Accounts, storage & access

- **Auth** — email + password with **JWT** (short access token + refresh). The
  token is verified by HTTP middleware and on the WebSocket handshake
  (`connectionParams`), so live channels aren't open to anonymous clients.
  Passwords are stored as **bcrypt** hashes.
- **Persistence** — **Postgres** holds users, boards, memberships and shapes.
  Persisted shape writes happen on release; transient moves, locks and cursors
  stay in-memory pub/sub (they're realtime, not durable state). Storage sits
  behind a `Store` interface with in-memory and Postgres implementations, so the
  server runs without a database (falling back to in-memory) — handy for tests.
- **Boards per user & sharing** — a board has an owner; opening a board's link
  joins you as a member (open-by-link collaboration). "My boards" lists what you
  can access.

---

## Real-time design

Two separate sync channels, on purpose:

- **Transient** — high-frequency, throttled (~40 ms), batched, last-write-wins.
  Used for cursor movement and live dragging. Lossy by design — the latest
  position is all that matters, so it favors **latency**.
- **Persisted** — low-frequency, reliable, one write on release. The final,
  correct state. Favors **correctness**.

Concurrent editing is coordinated with **soft-locks**: a client holding a shape
takes a short **lease** (renewed each frame); if it vanishes (closes the tab), the
lease lapses and a sweep returns the shape to normal. Soft, not hard — they
coordinate UX and self-heal, they never block a shape forever.

Live cursors are broadcast per client and rendered as a DOM overlay above the
canvas, smoothed with a CSS transition between throttled updates.

---

## Design decisions (why)

- **Canvas, not DOM** — a board holds many shapes; a DOM node per shape doesn't
  scale for pan/zoom/redraw.
- **Multi-layer + dirty-rect** — repaint only what changed, keep the heavy static
  layer still.
- **Two sync channels** — you can't have both lowest latency and guaranteed
  correctness on one channel; split them (transient for feel, persisted for truth).
- **Soft-locks over hard locks** — hard locks strand shapes when a client
  disappears; a self-healing lease avoids that.
- **GraphQL subscriptions over polling** — server-push realtime over a typed schema.
- **Text stored as flat text plus formatted ranges** — the shape Quill calls a
  Delta and Yjs stores natively. An array of styled runs would draw more
  directly, but text is where this board's realtime story is weakest
  (last-write-wins under a soft lock), and the way out is a CRDT. This model
  moves there without restructuring; runs would not, and every insertion would
  mean splitting and merging them rather than shifting an index.
- **Facade + injected controllers** — `BoardRuntime` had grown into a ~640-line
  god-object; splitting it into a thin facade + single-responsibility controllers
  (down to ~356 lines) made each piece testable in isolation.
- **`DOMMatrix` over a hand-rolled matrix** — a hardware-accelerated browser
  standard for coordinate transforms.

---

## Tech stack

**Frontend:** React, Vite, TypeScript, Apollo Client (GraphQL + WebSocket),
Tailwind CSS, Vitest, Playwright.

**Backend:** Go, [gqlgen](https://github.com/99designs/gqlgen), GraphQL
subscriptions over WebSocket, JWT auth (bcrypt), Postgres via
[pgx](https://github.com/jackc/pgx) with
[golang-migrate](https://github.com/golang-migrate/migrate) migrations. Falls
back to in-memory storage when no database is configured. See
[server/README.md](server/README.md).

---

## Project structure

```text
koi/
  client/    # frontend (React + Vite)
  server/    # backend (Go + gqlgen)
```

## Run locally

- **Frontend:** see [client/README.md](client/README.md)
- **Backend:** `cd server && go run ./cmd/api`
- **Database (optional):** `docker compose up -d db` starts Postgres, then run the
  backend with `DATABASE_URL=postgres://koi:koi@localhost:5432/koi?sslmode=disable`
  (see `server/.env.example`). Migrations apply automatically on boot. Without
  `DATABASE_URL` the backend falls back to in-memory storage. Override the host
  port with `DB_PORT` if 5432 is taken.

## Testing

- **Unit** ([Vitest](https://vitest.dev/)): pure canvas logic — coordinate/zoom
  math, dirty-rect geometry, resize, `EntityManager`, `LockManager`,
  `PresenceManager`, `GroupResizeController`, resize-handle hit-testing, and the
  text engine (wrapping across styles, the format model, shape commands). The
  text layout takes its measurement as a parameter, so it is tested without a
  canvas; only the DOM bridge of the editor needs one.
- **End-to-end** ([Playwright](https://playwright.dev/)): board load, persistence,
  and real-time broadcast across two browser contexts (events, locks, movement),
  plus a canvas snapshot. Details: [client/README.md](client/README.md#-testing).
- **Backend** (Go `testing`): store conformance suites run the same scenarios
  against both the in-memory and Postgres implementations (users, boards); the
  Postgres integration tests run when `TEST_DATABASE_URL` is set. Plus JWT and
  WebSocket-auth unit and handshake tests. See [server/README.md](server/README.md).
  </content>
