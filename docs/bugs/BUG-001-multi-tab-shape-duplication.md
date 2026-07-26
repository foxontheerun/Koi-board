# BUG-001: Shapes multiply across tabs on the same board

- **Area:** realtime sync
- **Severity:** blocker
- **Status:** investigating
- **Reported:** 2026-07-24
- **Reporter:** Shushuka (test22)

## Symptom

With the same board open in two browser tabs, shapes appear to duplicate and
pile up: the canvas fills with many overlapping rectangles and stray selection
bounding boxes where only a few shapes were created. The count grows well beyond
what was actually drawn. Selection outlines (teal rectangles) proliferate too.

See the reporter's screenshot (two tabs open, ~1 board's worth of stickies and
shapes exploding into dozens of overlapping copies).

## Repro

Not yet pinned down. Rough shape:

1. Open the same board in two tabs (both signed in as the same user).
2. Create / move shapes in one (or both) tabs.
3. Observe shapes multiplying across the canvas.

Frequency: seen once; needs a reliable repro. Open questions:
- Does it need edits in *both* tabs, or does one tab editing suffice?
- Does it trigger on move (transient) events, on persisted create, or on the
  initial board load query?
- Does a plain refresh of one tab reproduce it (i.e. is it re-adding on
  reconnect)?

## Expected

The two tabs converge on the same board state. A shape created once appears
once; moving a shape updates it in place. No duplication regardless of how many
tabs are open.

## Environment

- Client / server commit: 7806ca0 (branch test/db-stores)
- Browser: (to confirm)
- Storage: postgres (local, port 5433)

## Notes / hypothesis

Sync path lives in
`client/src/entities/Board/model/BoardSyncGateway.ts`. Leads to check:

- **Self-echo:** remote events are filtered by `clientID` (skip when
  `moved.clientID === this.clientId`). Confirm every incoming event carries a
  clientID and that the guard covers persisted create/`shapeEvents`, not just
  transient moves — an event with no/blank clientID would apply to its own
  sender and could double-insert.
- **Upsert vs insert:** `replaceAllShapes` on connect plus incoming
  `shapeEvents` create — if create appends instead of upserting by shape id, a
  shape seen via subscription *and* via the next board query would land twice.
- **Reconnect re-add:** the `connect()` query uses `network-only`; if the
  gateway reconnects (or React StrictMode double-mounts in dev) without clearing
  prior shapes, state could accumulate.
- **StrictMode double-mount (dev only):** `main.tsx` wraps the app in
  `React.StrictMode`; the board effect could run twice in dev, opening two
  gateways per tab. Worth ruling out vs. a genuine production bug.

Related: none yet.
