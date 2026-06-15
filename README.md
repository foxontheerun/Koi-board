# Realtime Board

An online board for real-time collaboration.
Frontend on React + Vite, backend on Go + GraphQL (gqlgen) with subscriptions.

> ⚠️ Project under active development. API and structure may change.

---

## Features

- Creating a board (`Board`) with a set of shapes (`Shape`)
- Shapes:
  - rectangles / blocks
  - ellipses
  - text blocks
- Moving and resizing shapes
- Editing text
- Multi-selection
- Layer (z-index) controls
- Synchronizing changes between clients via GraphQL:
  - `query` for getting a board
  - `mutation` for updating a shape
  - `subscription` for receiving real-time updates

---

## Technologies

**Frontend**

- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- TypeScript
- Apollo Client (GraphQL)
- Tailwind CSS
- UI:
  - custom components
  - [lucide-react](https://lucide.dev/) for icons

**Backend**

- Go
- [gqlgen](https://github.com/99designs/gqlgen) (GraphQL server)
- WebSocket subscriptions (GraphQL Subscriptions)
- Currently in-memory data storage (data is reset on server restart)

---

## Project Structure

```text
realtime-board/
  client/    # frontend (React + Vite)
  server/    # backend (Go + gqlgen)
```

## How to run locally

- Front: check README.md in `client/`
- Back: `go run ./cmd/api`
