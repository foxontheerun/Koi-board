# Realtime Whiteboard — Client

Frontend application for an interactive realtime whiteboard.  
Supports live collaboration, shape creation, resizing, movement, z-index control, zooming, and GraphQL-based synchronization.

## 🚀 Tech Stack

- **React 18**
- **TypeScript**
- **Vite**
- **TailwindCSS**
- **react-rnd** — drag & resize
- **Apollo Client 4** — GraphQL + WebSocket transport
- **GraphQL Subscriptions** — realtime updates

Backend: `Go + gqlgen` with WebSocket streaming.

---

## ✨ Features

### Implemented

- Rendering the board and grid
- Adding and displaying shapes (`RECT`, `TEXT`)
- Dragging and moving shapes
- Resizing shapes (with realtime updates to other clients)
- Zooming and viewport offset calculation
- Shape selection and context menu
- Layer (z-index) controls:
  - Bring to front
  - Send to back
  - Move one layer up
  - Move one layer down
- Realtime synchronization between clients:
  - **Transient updates** (fast x/y/width/height patches sent while dragging)
  - **Persisted updates** (final save after user releases the mouse)

### Planned / TODO

- More shape types (`ELLIPSE`, image, line, arrow)
- Undo/Redo history
- Multi-selection
- Keyboard shortcuts
- Pan/Hand tool for moving the entire board

---

## 🛠️ Installation & Development

```bash
cd client
npm install
npm run dev
```

---

## 🧪 Testing

**Unit** — [Vitest](https://vitest.dev/): canvas pure logic (coordinate/zoom
math, colors, dirty-rect geometry, resizing), `EntityManager`, `LockManager`.

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
