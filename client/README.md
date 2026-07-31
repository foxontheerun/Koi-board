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
- Text:
  - Standalone text blocks and text inside stickers, wrapped by width
  - Editing in place through a DOM overlay that follows the camera and matches
    the canvas metrics
  - Side handles reflow the text, corner handles scale the font with the block;
    height can be given slack but never crops the text
- Realtime collaboration between clients:
  - **Live cursors** (presence) rendered as a smoothed DOM overlay, each with an
    editable **display name** (auto-generated, persisted in localStorage)
  - **Soft-locks** so two clients don't fight over the same shape, including
    while text is being edited
  - **Transient updates** (fast x/y/width/height patches sent while dragging)
  - **Live text updates** while typing, and a **persisted update** on commit

### Planned / TODO

- Text styling (size, colour, alignment) beyond the font size a corner drag sets
- More shape types (image, line, arrow)
- Undo/Redo history
- Keyboard shortcuts
- Authentication & per-board access control — see [docs/AUTH_PLAN.md](docs/AUTH_PLAN.md)

---

## Installation & Development

```bash
cd client
npm install
npm run dev
```

The backend URL is read from `VITE_API_URL` / `VITE_WS_URL` (see `.env.example`);
both default to `localhost:8080`, so no `.env` is needed for local dev.

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
