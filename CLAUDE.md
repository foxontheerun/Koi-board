# Koi — project guide

Real-time collaborative whiteboard. Custom Canvas rendering engine (no rendering
library) + Go/GraphQL backend with WebSocket subscriptions and Postgres.

**Start with [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — the layering, the
rendering pipeline, how a change travels to other clients, and the decisions
behind it. (`docs/` is gitignored, so this file is local only.)

See also [README.md](README.md), [client/README.md](client/README.md),
[server/README.md](server/README.md), and `client/docs/*.md` (auth, conflict, sync
plans).

## Layout

```
client/   React + Vite + TypeScript (Apollo, Tailwind, Vitest, Playwright)
server/   Go + gqlgen (auth, users, boards, db, resolvers, pub/sub packages)
```

## Commands

Client (`cd client`):
```
npm run dev            # dev server (5173, or 5174 if taken)
npm run test:run       # vitest once
npm run test:e2e       # Playwright
npm run build          # tsc + vite build
npx tsc --noEmit       # typecheck
```

Server (`cd server`):
```
go run ./cmd/api                       # http://localhost:8080/ (playground at /)
go build ./...                         # build
go test ./...                          # unit tests
go run github.com/99designs/gqlgen generate   # regen after editing graphql/*.graphqls
```

Database (repo root):
```
docker compose up -d db                # Postgres; override host port with DB_PORT
DATABASE_URL=postgres://koi:koi@localhost:5432/koi?sslmode=disable go run ./cmd/api
TEST_DATABASE_URL=postgres://koi:koi@localhost:5433/koi?sslmode=disable go test ./...  # + integration
```

## Gotchas

- **DB host port 5432 is often taken locally** (another project). Use
  `DB_PORT=5433 docker compose up -d db` and point `DATABASE_URL`/`TEST_DATABASE_URL`
  at 5433.
- **No database configured → in-memory fallback.** The server runs fine without
  `DATABASE_URL` (users/boards/shapes reset on restart). Both stores implement the
  same `Store` interface; `cmd/api` picks by env.
- **Data access is hand-written pgx, not sqlc.** sqlc's `go run` build is
  prohibitively slow on this machine; plain SQL in `users/postgres.go` and
  `boards/postgres.go` is intentional.
- **gqlgen moves helper funcs out of `*.resolvers.go`** on regen (into a WARNING
  block). Keep helpers in non-resolver files (e.g. `resolvers/auth_helpers.go`).
- **Board/shape ids are `text`** (board id from URL / server uuid; shape id is a
  client uuid). `users.id` is a `uuid`. Migrations in `server/db/migrations` run on
  boot via embedded golang-migrate.
- Realtime channels (cursors, transient moves, soft-locks) are **in-memory pub/sub
  only** — never persisted.

## Conventions

- **No comments in code** — the codebase is deliberately comment-free; match it.
- **No emojis in docs.**
- Conventional-commit messages, one logical change per commit; do not commit or
  push without being asked.
- Schema-first: edit `server/graphql/*.graphqls`, then regenerate.

## State & next steps

Done: auth (JWT over HTTP + WS, bcrypt), Postgres persistence (users, boards,
shapes), board ownership + open-by-link sharing, "My boards", store conformance
tests (in-memory + Postgres), text (wrapping, standalone blocks, in-place editing,
live sync while typing).

Open follow-ups:
- Tests: resolver-level (signup→login→me), client (authStore/AuthContext); adapt
  the Playwright e2e suite to auth + boards.
- Product backlog (`client/README.md`): Undo/Redo, keyboard shortcuts, more shape
  types (image/line/arrow), text styling.
- Optional: password reset flow; move JWT secret handling to required-in-prod.

## Dev shortcuts

- `DEV_NO_AUTH=1` (server) + `VITE_DEV_NO_AUTH=1` (client `.env`) skip the login
  screen and treat every request as a `dev@local` user. Off by default.
- **Integration tests truncate the database they point at.** Give
  `TEST_DATABASE_URL` its own database, not the one `DATABASE_URL` uses, or the
  dev data goes with it.
