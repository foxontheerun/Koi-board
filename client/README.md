# Realtime Whiteboard — Client

Frontend application for an interactive realtime whiteboard.  
Supports live collaboration (remote cursors, soft-locks), shape creation, resizing, movement, z-index control, zooming, and GraphQL-based synchronization.

## Tech Stack

- **React 19**
- **TypeScript**
- **Vite**
- **TailwindCSS**
- **react-rnd** — drag & resize
- **Apollo Client 4** — GraphQL + WebSocket transport
- **GraphQL Subscriptions** — realtime updates

Backend: `Go + gqlgen` with WebSocket streaming.

---

## Features

### Implemented

- Rendering the board and grid
- Adding and displaying shapes (`RECT`, `ELLIPSE`, `STICKER`)
- Inline text editing on a shape (double-click)
- Dragging, moving and resizing shapes (with realtime updates to other clients)
- Zooming, panning and viewport offset calculation
- Multi-selection (drag-select box)
- Shape selection, right-click context menu and a floating selection toolbar
- Lock / unlock shapes (locked shapes are protected from edits and deletion)
- Layer (z-index) controls:
  - Bring to front
  - Send to back
  - Move one layer up
  - Move one layer down
- Realtime collaboration between clients:
  - **Live cursors** (presence) rendered as a smoothed DOM overlay
  - **Soft-locks** so two clients don't fight over the same shape
  - **Transient updates** (fast x/y/width/height patches sent while dragging)
  - **Persisted updates** (final save after user releases the mouse)

### Planned / TODO

- Standalone text shape tool (`TEXT` type exists, no creation UI yet)
- More shape types (image, line, arrow)
- Undo/Redo history
- Keyboard shortcuts
- Cursor labels / user names in presence

---

## Installation & Development

```bash
cd client
npm install
npm run dev
```

---

## Testing

**Unit** — [Vitest](https://vitest.dev/): canvas pure logic (coordinate/zoom
math, colors, dirty-rect geometry, resizing), `EntityManager`, `LockManager`,
`PresenceManager`.

```bash
npm test          # watch mode
npm run test:run  # single run
```

**End-to-end** — [Playwright](https://playwright.dev/) (Chromium). The config
starts/reuses the dev server and the Go backend, so the suite is self-contained.
Covers board load, persistence, realtime broadcast across two browser contexts
(events, locks, movement), and a canvas snapshot (visual regression).

```bash
npm run test:e2e                        # run all
npm run test:e2e -- --update-snapshots  # refresh visual baselines
```

Snapshot baselines are committed per platform; regenerate them with
`--update-snapshots` on a new OS.
