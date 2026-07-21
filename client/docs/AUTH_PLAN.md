# Authentication & Authorization — Work Plan

How we will introduce real user identity, sign-in, and per-board access control
on top of what is today a fully anonymous, single-shared-board app.

> Status: in progress — backend skeleton landed (see Progress); wiring next.

Strategy: **JWT (access + refresh) over email + password**, verified on both HTTP
requests and the WebSocket handshake. Chosen over server-side session cookies
because a token in the subscription `connectionParams` is the natural fit for our
Apollo GraphQL-over-WebSocket transport, and a working token/hashing skeleton
already exists.

---

## Progress (state of play)

Branch `feat/auth` (skeleton cherry-picked from the earlier `feat/jwt-auth`):

Done — **backend primitives**:
- **`server/users`** — in-memory user store keyed by email; `Register` /
  `GetByEmail` (password verify) / `GetByID`. Passwords hashed with **bcrypt**,
  never stored in plaintext.
- **`server/auth`** — HS256 JWT: `GenerateAccessToken` (15 min),
  `GenerateRefreshToken` (7 days), `ParseToken` (distinguishes expired vs
  invalid). `Claims` carries `userID`.

Next:
- **P1 ⏳** — GraphQL `signup` / `login` / `refresh` mutations + a `me` query,
  returning tokens; resolvers wired to `users` + `auth`.
- **P2..P5** — see the phased plan below.

Known gaps to fix while wiring (not blockers, but must land before this is real):
- **Secret is hardcoded** (`jwtSecret = "super-secret-change-in-prod"`) — move to
  an env var, fail fast if unset in production.
- **In-memory store** resets on restart — fine for now; Postgres is a later,
  non-blocking swap.
- No token revocation list yet — acceptable for a short access-token TTL.

Today there is otherwise **no auth**: the only identity is an anonymous per-tab
`clientID` (echo suppression + presence/lock keying), and WebSocket subscriptions
and mutations are open to anyone who reaches the endpoint.

---

## 1. Problem

Move from "anonymous shared canvas" to "named users with their own boards",
without breaking the collaboration model that already works.

Two distinct concerns, often conflated:

- **Authentication (authn)** — *who are you*. Sign up / sign in, a durable user
  identity, a credential the server verifies on every request and every socket.
- **Authorization (authz)** — *what may you touch*. Which boards a user owns or is
  invited to, and read-vs-edit rights.

---

## 2. Chosen strategy — JWT

**Server-issued JWT (access + refresh) over email + password.** On login the
server returns a short-lived **access token** and a longer-lived **refresh
token**. The client attaches the access token to every GraphQL request (HTTP
header) and to the subscription handshake (`connectionParams`). The server
verifies the signature — no session lookup needed.

| Concern | How JWT handles it here |
|---|---|
| Per-request proof | Signed token in the `Authorization` header; verified by signature. |
| WebSocket proof | Same token passed in Apollo's `connectionParams` on connect. |
| Expiry / rotation | Short access TTL (15 min) + refresh token (7 days) → `refresh` mutation mints a new access token. |
| Password safety | bcrypt hash, never plaintext (already implemented). |

Trade-offs we accept (reasonable for this project, data is non-sensitive and
storage is in-memory):

- **Revocation is not instant** — a token stays valid until it expires. Mitigated
  by the short access TTL; a refresh-token denylist can come later if needed.
- **Token storage on the client** — keep the **access token in memory** (not
  localStorage) to limit XSS exposure; the refresh token can live in memory too
  and be re-obtained by re-login, or in an httpOnly cookie later.

`clientID` does **not** go away — it stays as the anonymous *connection* id for
echo suppression and presence/lock keying. Once a connection is authenticated it
is associated with a `userID` server-side, and the presence display name (shipped
already as an editable label) starts coming from the user record instead of being
typed in.

---

## 3. Design

### Packages (server)

```
server/users  — user store + bcrypt (done)
server/auth   — JWT generate/parse (done)
```

### GraphQL (P1)

```graphql
type AuthPayload {
  accessToken: String!
  refreshToken: String!
  user: User!
}

type User {
  id: ID!
  email: String!
}

extend type Mutation {
  signup(email: String!, password: String!): AuthPayload!
  login(email: String!, password: String!): AuthPayload!
  refresh(refreshToken: String!): AuthPayload!
}

extend type Query {
  me: User          # null when unauthenticated
}
```

### Request context (P2)

- HTTP middleware reads `Authorization: Bearer <token>`, calls `auth.ParseToken`,
  loads the user, and puts `currentUser` on the resolver context (nil if absent
  or invalid). A `requireUser(ctx)` helper guards protected resolvers.

### WebSocket auth (P3)

- On the subscription `InitPayload`, read the token from `connectionParams`,
  verify it, and reject the connection if missing/invalid. This closes today's
  open-subscription hole. gqlgen's `websocket.Upgrader` + `InitFunc` is the hook.

### Client (P4)

- Sign-in / sign-up screens; an auth gate around the board.
- Apollo: an auth link that adds the `Authorization` header; the WS link passes
  the token via `connectionParams`; a 401 / expired path that calls `refresh`
  (or redirects to sign-in).
- The presence display name comes from the signed-in user.

### Boards per user (P5)

- `boards` become owned; `memberships` (role: owner/editor/viewer); a
  `requireMember(ctx, boardId, minRole)` guard on every board-scoped resolver and
  subscription.

---

## 4. Testing strategy

1. **Unit** — password hashing/verify (done-ish, add cases), token
   generate/parse/expire, and the `requireUser` / `requireMember` guards as pure
   decisions.
2. **Integration** — resolver-level: anonymous request rejected on a protected
   field; valid token passes; expired token treated as anonymous; `refresh`
   issues a working new access token.
3. **WS auth** — a subscription without a valid token is refused at handshake; a
   valid one receives events.
4. **E2E smoke (Playwright)** — sign up, create a board, reload keeps you in,
   sign out blocks access.

### Invariants to assert

- [ ] **No anonymous write** — every board mutation requires a valid token.
- [ ] **No anonymous subscribe** — live channels reject unauthenticated sockets.
- [ ] **Expiry respected** — an expired access token is rejected; refresh works.
- [ ] **Ownership** — a non-member can neither read nor write another user's board.

---

## 5. Phased plan

- [x] **P0 — Decide & spec.** JWT over email+password; access 15 min + refresh
      7 days; bcrypt; tokens on HTTP header and WS `connectionParams`.
- [x] **P0.5 — Primitives.** `server/users` (bcrypt store) + `server/auth` (JWT).
- [ ] **P1 — Auth mutations.** `signup` / `login` / `refresh` + `me`; resolvers
      wired to `users` + `auth`. Move the JWT secret to an env var.
- [ ] **P2 — Request context.** HTTP middleware → `currentUser` in context;
      `requireUser` guard.
- [ ] **P3 — WebSocket auth.** Verify the token on the subscription handshake;
      reject unauthenticated sockets.
- [ ] **P4 — Client.** Sign-in / sign-up UI; Apollo header + WS `connectionParams`
      wiring; refresh/401 handling; name from the user record.
- [ ] **P5 — Boards per user.** Ownership + memberships + `requireMember` guard;
      "my boards" list.
- [ ] **P6 — Tests & E2E smoke.** The invariants above.

Persistence (Postgres) is intentionally deferred — the whole flow runs on the
in-memory store first; swapping storage later does not change the plan.

---

## 6. Open questions

- **Refresh-token storage** — memory (re-login on reload) vs httpOnly cookie
  (survives reload, needs cookie plumbing)? Start with memory, revisit in P4.
- **Revocation** — do we need a refresh-token denylist / logout-everywhere, or is
  short-TTL access enough for this project? Likely enough for now.
- **Guest / anonymous boards** — keep a "no sign-in, shareable link" mode
  alongside accounts, or require sign-in for everything?
- **Persist users now or later?** Storage swap (Postgres) is unblocked any time;
  fold in with P5 or keep separate.

---

See also:
[CONFLICT_RESOLUTION_PLAN.md](./CONFLICT_RESOLUTION_PLAN.md) and
[REALTIME_TRANSIENT_SYNC_ARCHITECTURE.md](./REALTIME_TRANSIENT_SYNC_ARCHITECTURE.md)
for the collaboration layers this sits on top of.
