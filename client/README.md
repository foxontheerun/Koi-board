# Realtime Whiteboard — Client

Frontend application for an interactive realtime whiteboard.
Supports live collaboration, shape creation, resizing, movement, z-index control, zooming, and GraphQL-based synchronization.

## 🚀 Tech Stack

- **React 18**
- **TypeScript**
- **Vite**
- **TailwindCSS**
- **Apollo Client 4** — GraphQL + WebSocket transport
- **GraphQL Subscriptions** — realtime updates

Backend: `Go + gqlgen` with WebSocket streaming.

---

## ✨ Features

### Implemented

- Rendering the board and grid
- Adding and displaying shapes (`RECT`, `ELLIPSE`, `TEXT`)
- Dragging and moving shapes
- Resizing shapes (with realtime updates to other clients)
- Zooming and viewport offset calculation
- Shape selection and context menu
- Multi-selection
- Layer (z-index) controls:
  - Bring to front
  - Send to back
  - Move one layer up
  - Move one layer down
- Realtime synchronization between clients:
  - **Transient updates** (fast x/y/width/height patches sent while dragging)
  - **Persisted updates** (final save after user releases the mouse)

### Planned / TODO

- More shape types (image, line, arrow)
- Undo/Redo history
- Keyboard shortcuts
- Pan/Hand tool for moving the entire board

---

## 🛠️ Installation & Development

```bash
cd client
npm install
npm run dev
```
