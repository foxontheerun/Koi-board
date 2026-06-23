# Realtime Board

![photo_2026-03-20_02-57-40](https://github.com/user-attachments/assets/4ad7a45a-50c8-4812-90b6-824cf654e945)

An online board for real-time collaboration.  
Frontend on React + Vite, backend on Go + GraphQL (gqlgen) with subscriptions.

> ⚠️ Project under active development. API and structure may change.

---

## Features

- Creating a board (`Board`) with a set of shapes (`Shape`)
- Shapes:
  - rectangles / blocks
  - text blocks
- Moving and resizing shapes
- Editing text
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
- [Vitest](https://vitest.dev/) for unit tests
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

## How to run localy

- Front: check README.md in client path
- Back: `go run ./cmd/api`

## Testing

Unit tests for the client are written with [Vitest](https://vitest.dev/) and
cover the canvas pure logic: coordinate/zoom math, color helpers, dirty-rect
geometry, shape resizing, and the `EntityManager` state (hit testing, shape
events, transient updates).

Run from the `client/` folder:

```bash
npm test          # watch mode
npm run test:run  # single run
```


