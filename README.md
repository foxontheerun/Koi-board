# Koi

![demo](https://github.com/user-attachments/assets/3afe6093-203f-4352-98d6-b9845063672f)

**A real-time collaborative whiteboard with a custom Canvas rendering engine and
multi-user synchronization.** Multiple people edit the same board at once — shapes,
selection, layers — with live cursors and conflict handling, rendered on a
hand-written Canvas engine (no rendering library).

Frontend: React + Vite + TypeScript. Backend: Go + GraphQL (gqlgen) with
WebSocket subscriptions.

> ⚠️ Under active development — API and structure may change.

---

## Features

- **Custom Canvas rendering engine** — multi-layer, no rendering library
- **Real-time collaboration** — multiple users on one board, live cursors, soft-locks
- Shapes: rectangles, ellipses, sticky notes; inline text editing on a shape
- Move, resize (zoom-aware handles), pan, zoom-around-cursor
- **Selection system** — click, drag-select, Shift to extend, single group frame,
  **group resize** (scale the whole selection proportionally)
- Layer order (front / back / forward / backward), lock / unlock
- Right-click context menu + floating selection toolbar

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
subscriptions over WebSocket. Storage is currently in-memory (resets on restart).

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

## Testing

- **Unit** ([Vitest](https://vitest.dev/)): pure canvas logic — coordinate/zoom
  math, dirty-rect geometry, resize, `EntityManager`, `LockManager`,
  `PresenceManager`, `GroupResizeController`, resize-handle hit-testing.
- **End-to-end** ([Playwright](https://playwright.dev/)): board load, persistence,
  and real-time broadcast across two browser contexts (events, locks, movement),
  plus a canvas snapshot. Details: [client/README.md](client/README.md#-testing).
  </content>
