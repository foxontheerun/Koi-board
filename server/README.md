# Koi — Server

Backend for the Koi realtime whiteboard: **Go + GraphQL (gqlgen)** with WebSocket
subscriptions, JWT auth, and Postgres persistence.

## Tech Stack

- **Go**
- **[gqlgen](https://github.com/99designs/gqlgen)** — schema-first GraphQL, codegen
- **GraphQL subscriptions** over WebSocket (`gorilla/websocket`)
- **JWT** (`golang-jwt`) + **bcrypt** (`golang.org/x/crypto`) for auth
- **Postgres** via **[pgx](https://github.com/jackc/pgx)** (pgxpool)
- **[golang-migrate](https://github.com/golang-migrate/migrate)** — migrations run on boot (embedded)

---

## Structure

```text
server/
  cmd/api/          # entrypoint: wires the schema, transports, CORS, auth, storage
  graphql/          # *.graphqls schema (source of truth for codegen)
  graph/            # gqlgen-generated code (generated.go, models_gen.go)
  resolvers/        # resolver implementations + auth guards
  auth/             # JWT (access/refresh), HTTP middleware, WS init, request context
  users/            # user Store: MemoryStore + PostgresStore (bcrypt)
  boards/           # board Store: MemoryStore + PostgresStore (boards, shapes, membership)
  db/               # pgxpool connection + embedded migrations
  db/migrations/    # SQL migrations (0001_init, then text styling and formats)
  presence/         # cursor pub/sub (in-memory)
  transient/        # transient move pub/sub (in-memory)
  locks/            # soft-lock pub/sub (in-memory)
  subscriptions/    # persisted shape-event pub/sub (in-memory)
```

## Architecture notes

- **Storage behind a `Store` interface.** `users.Store` and `boards.Store` each
  have an in-memory and a Postgres implementation. `cmd/api` picks Postgres when
  `DATABASE_URL` is set, otherwise the in-memory store — so the server (and its
  tests) run without a database.
- **Durable vs realtime.** Users, boards, memberships and shapes are persisted.
  Transient moves, soft-locks and cursors are **in-memory pub/sub** only — they're
  realtime signals, not durable state, and never touch the database.
- **Auth on both transports.** HTTP middleware and the WebSocket `InitFunc` both
  verify the JWT and inject the user id into the request/subscription context.
  Every operation that names a board — mutations and subscriptions alike — then
  goes through `requireBoardAccess`, which answers "may *this* user touch *this*
  board" rather than merely "is this a user".
- **Two delivery modes.** Cursors and transient moves are lossy on purpose: only
  the latest position matters, so a full channel means the message is dropped.
  Shape events are not — a missed create or delete leaves the board silently
  wrong — so a subscriber that overflows its buffer is disconnected instead, and
  reconnects onto a fresh read of the board.
- **Migrations on boot.** When a database is configured, embedded migrations are
  applied automatically at startup (idempotent).
- **Shape writes are patches.** `updateShape` is a single
  `INSERT ... ON CONFLICT DO UPDATE` with `COALESCE` per column, so a client
  sends only what changed, and `RETURNING (xmax = 0)` tells an insert from an
  update in the same round trip. The trade-off is that null means "leave alone",
  so a field cannot be cleared by sending null — an emptied text is sent as an
  empty string.
- **Text carries its formatting.** Besides `text`, a shape has block-level style
  (`fontSize`, `fontWeight`, `textAlign`, `textColor`) and `textFormats`: the
  ranges that style parts of the text, stored as JSON in a `text` column. There
  is no JSON scalar in the schema because nothing else needs one.

---

## Run locally

Without a database (in-memory, resets on restart):

```bash
cd server
go run ./cmd/api          # http://localhost:8080/ (GraphQL playground at /)
```

With Postgres (persistent) — from the repo root:

```bash
docker compose up -d db   # starts Postgres (override host port with DB_PORT)
cd server
DATABASE_URL=postgres://koi:koi@localhost:5432/koi?sslmode=disable \
JWT_SECRET=change-me \
go run ./cmd/api
```

### Environment

| Var            | Purpose                                        | Default (dev)              |
| -------------- | ---------------------------------------------- | -------------------------- |
| `DATABASE_URL` | Postgres connection string; unset → in-memory  | *(unset)*                  |
| `JWT_SECRET`   | JWT signing key; a dev fallback is used if unset | *(insecure dev fallback)* |
| `DEV_NO_AUTH`  | `1` treats every request without a token as a `dev@local` user, on HTTP and the websocket alike. Pair with `VITE_DEV_NO_AUTH=1` on the client | *(off)* |

See `.env.example`.

---

## Codegen (gqlgen)

The schema in `graphql/*.graphqls` is the source of truth. After changing it,
regenerate `graph/` (and resolver stubs):

```bash
cd server
go run github.com/99designs/gqlgen generate
```

Keep helper functions out of `*.resolvers.go` files — gqlgen moves them aside on
regen (they live in e.g. `resolvers/auth_helpers.go`).

---

## Testing

```bash
cd server
go test ./...                                                   # unit tests
TEST_DATABASE_URL=postgres://koi:koi@localhost:5433/koi?sslmode=disable \
  go test ./...                                                 # + Postgres integration
```

- **Store conformance suites** (`users`, `boards`) run the same scenarios against
  both the in-memory and Postgres implementations. The Postgres cases **skip**
  unless `TEST_DATABASE_URL` is set; when set they migrate + truncate a real
  database and exercise the actual SQL (unique index, foreign keys, upsert,
  open-by-link membership). A new shape field is not done until this suite checks
  it in both stores.

> **`TEST_DATABASE_URL` gets truncated.** Point it at its own database, not the
> one `DATABASE_URL` uses, or the tests will take your dev data with them.
- **Auth** — JWT and `StripBearer` unit tests, plus a real-socket WebSocket
  handshake test proving unauthenticated sockets are refused.
