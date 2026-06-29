# Realtime Board

![photo_2026-03-20_02-57-40](https://github.com/user-attachments/assets/4ad7a45a-50c8-4812-90b6-824cf654e945)

An online board for real-time collaboration.  
Frontend on React + Vite, backend on Go + GraphQL (gqlgen) with subscriptions.

> ⚠️ Project under active development. API and structure may change.

---

## Features

- Creating a board (`Board`) with a set of shapes (`Shape`)
- Shapes: rectangles, ellipses, sticky notes
- Moving, resizing, and editing shapes (inline text editing on a shape)
- Layer order: bring to front / send to back / move forward / backward
- Lock / unlock shapes (locked shapes are protected from move, resize, layer
  changes and deletion)
- Right-click context menu and a floating selection toolbar; actions apply to
  the whole selection
- Real-time collaboration: live remote cursors, soft-locks, and changes synced
  over GraphQL (`query` / `mutation` / `subscription`)

---

## Realtime collaboration

- **Two sync channels:** a high-frequency transient stream (throttled,
  last-write-wins) for smooth dragging, plus a reliable persisted stream for
  final state.
- **Soft-locks** with a short lease so two clients don't fight over the same
  shape; expired leases self-heal.
- **Live cursors:** each client broadcasts its pointer position; remote cursors
  render as a DOM overlay above the canvas, smoothed with CSS.

---

## Technologies

**Frontend**

- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- TypeScript
- Apollo Client (GraphQL)
- Tailwind CSS
- [Vitest](https://vitest.dev/) for unit tests
- UI:
  - custom components
  - [lucide-react](https://lucide.dev/) for icons

**Backend**

- Go
- [gqlgen](https://github.com/99designs/gqlgen) (GraphQL server)
- WebSocket subscriptions (GraphQL Subscriptions) for shapes, locks and cursors
- Currently in-memory data storage (data is reset on server restart)

---

## Project Structure

```text
realtime-board/
  client/    # frontend (React + Vite)
  server/    # backend (Go + gqlgen)
```

## How to run localy

- Front: check README.md in client path
- Back: `go run ./cmd/api`

## Testing

The client has unit tests ([Vitest](https://vitest.dev/)) and end-to-end tests
([Playwright](https://playwright.dev/), including two-client realtime and a
canvas snapshot). Commands and details: [client/README.md](client/README.md#-testing).


