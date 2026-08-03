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
  - **Formatting per selection** - size, weight and colour apply to the selected
    range, or to the whole block when nothing is selected. Stored as flat text
    plus ranges of attributes, the shape Quill calls a Delta and Yjs stores
    natively, so collaborative editing can be added without restructuring it
- Realtime collaboration between clients:
  - **Live cursors** (presence) rendered as a smoothed DOM overlay, each with an
    editable **display name** (auto-generated, persisted in localStorage)
  - **Soft-locks** so two clients don't fight over the same shape, including
    while text is being edited
  - **Transient updates** (fast x/y/width/height patches sent while dragging)
  - **Live text updates** while typing, and a **persisted update** on commit

### Planned / TODO

- Grouping shapes (a parent link and an ordering key; see docs)
- Pending format at a collapsed caret - press bold, then type bold
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

Set `VITE_DEV_NO_AUTH=1` (with `DEV_NO_AUTH=1` on the server) to skip the login
screen while working on the board itself. Both default to off and only work
together.

### Where things live

```text
src/
  app/         Apollo client, providers, global styles
  canvas/      the rendering engine - plain TypeScript, no React
    camera/       world <-> screen, zoom, pan
    core/         BoardRuntime (facade), ShapeCommands
    entities/     the scene, the shape model, text layout
    interaction/  pointer, drag, resize, creation
    rendering/    the four layers and their dirty rects
    collab/       soft locks, remote cursors
  entities/    board and shape - domain models and their UI
  features/    auth, presence, colour picker, selection menu
  pages/       routed screens
  shared/      primitives and design tokens
  widgets/     toolbar, top bar
```

The canvas engine sits outside the feature-sliced hierarchy on purpose: it is a
self-contained subsystem that React mounts and otherwise leaves alone, which is
why dragging a shape across a crowded board re-renders no components.

---

## Testing

**Unit** — [Vitest](https://vitest.dev/): canvas pure logic (coordinate/zoom
math, colors, dirty-rect geometry, resizing), `EntityManager`, `LockManager`,
`PresenceManager`, and the text engine — wrapping across mixed styles, the
format model, and `ShapeCommands`.

Most of it runs without a DOM: the text layout takes its measurement function as
a parameter, so tests supply arithmetic instead of a canvas. The editor's DOM
bridge is the exception and runs under happy-dom, declared per file with
`// @vitest-environment happy-dom`.

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
