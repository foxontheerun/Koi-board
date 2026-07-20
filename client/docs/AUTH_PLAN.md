# Authentication & Authorization — Work Plan

How we will introduce real user identity, sign-in, and per-board access control
on top of what is today a fully anonymous, single-shared-board app.

> Status: not started — this is a design/scoping document.

---

## Progress (state of play)

Nothing built yet. This doc exists so auth is an explicit, phased backlog item
rather than an afterthought.

Today there is **no auth of any kind**:

- The only notion of a user is `clientID` — an anonymous, per-tab identifier used
  to suppress a client's own echoes and to key presence / soft-locks. It is not
  an account: close the tab and it is gone. Cursor color is derived from it
  deterministically (`colorFromId`), so identity is throwaway by design.
- The backend keeps everything **in-memory** (resets on restart). No database,
  no users, no sessions.
- One shared board. WebSocket subscriptions and mutations are open — anyone who
  reaches the endpoint can read and write.

So auth is **not** the next feature off the backlog; it is a separate
infrastructure layer with no foundation underneath it yet. It has to bring its
own storage, identity model, and transport hardening.

---

## 1. Problem

We want to move from "anonymous shared canvas" to "named users with their own
boards", without throwing away the collaboration model that already works.

Two distinct concerns, often conflated:

- **Authentication (authn)** — *who are you*. Sign up / sign in, a durable user
  identity, a credential the server can verify on every request and every socket.
- **Authorization (authz)** — *what may you touch*. Which boards a user owns or is
  invited to, and read-vs-edit rights.

Both depend on a prerequisite the project doesn't have yet: **persistent
storage**. You can't have durable users or board ownership on an in-memory server.

---

## 2. Chosen strategy

**Introduce persistence first, then session-based authn, then per-board authz —
in that order.** Each phase is shippable on its own and de-risks the next.

- **Storage:** Postgres (users, boards, memberships; shapes can migrate off
  in-memory later). Chosen over embedding auth in a third-party provider so the
  backend stays self-contained and the schema is ours.
- **Authn:** server-issued **session cookie** (httpOnly, SameSite) backed by a
  session table, over email + password to start. A JWT alternative is noted in
  Open questions; a cookie is simpler to revoke and to attach to the WS handshake.
- **Authz:** board **ownership + membership** rows; a resolver-level guard checks
  membership before any board read/write or subscription.

Why this order:

| Order | Why |
|---|---|
| Storage → Authn → Authz | Authn needs a place to store users; authz needs boards to own. Each layer sits on the one below. |
| Authz → Authn → Storage | Backwards — nothing to authorize against, nowhere to persist it. |

The guiding principle mirrors the locks work: **the client is never the source of
truth**. `clientID` stays as a transport/echo detail, but trust decisions move to
the server, keyed off the verified session — never off a value the client sends.

### Relationship to `clientID` and presence

`clientID` does **not** go away. It keeps doing its job (echo suppression,
presence/lock keying) as an anonymous *connection* id. What changes:

- A signed-in connection is **associated** with a `userId` server-side.
- Presence can then carry a **display name** (see the cursor-labels feature,
  which is the first, auth-light step toward this — a name typed in, no password).
- Once accounts exist, the display name and cursor color come from the user
  record instead of being derived from a throwaway id.

---

## 3. Design

### Data model (Postgres)

```sql
users        (id, email UNIQUE, password_hash, display_name, created_at)
sessions     (id, user_id, expires_at, created_at)       -- opaque token in cookie
boards       (id, owner_id, title, created_at)
memberships  (board_id, user_id, role)                   -- role: 'owner' | 'editor' | 'viewer'
```

Shapes stay in-memory for now (out of scope here); persisting them is a separate
follow-up that this storage layer unblocks.

### Server

- **Auth mutations:** `signup`, `login`, `logout`. `login` sets an httpOnly
  session cookie; `logout` deletes the session row.
- **Context middleware:** resolve the session cookie → `currentUser` on the
  gqlgen resolver context (nil if anonymous).
- **WebSocket handshake:** validate the session cookie on the subscription
  `InitPayload` / upgrade, so live channels are authenticated too — not just HTTP
  mutations. This is the easy-to-miss part: today subscriptions are wide open.
- **Authz guard:** a helper (`requireMember(ctx, boardId, minRole)`) called at the
  top of every board-scoped resolver and subscription.

### Client

- **Auth UI:** minimal sign-in / sign-up screen; an auth gate around the board.
- **Apollo:** send cookies (`credentials: 'include'`), pass the session on the WS
  link's `connectionParams`, and handle 401 → redirect to sign-in.
- **Board list:** "my boards" once boards are per-user (replaces the single
  hardcoded board id).

### Protocol additions

- `signup` / `login` / `logout` mutations; `me: User` query.
- `board`/`boards` become user-scoped; creating a board sets `owner_id`.
- Presence `CursorPresence` gains an optional `name` (already useful pre-auth for
  cursor labels; becomes the user's `display_name` post-auth).

---

## 4. Testing strategy

1. **Unit** — password hashing/verify, session issue/expire/revoke, and the
   `requireMember` guard as a pure decision (role × action → allow/deny).
2. **Integration** — resolver-level: anonymous request is rejected on a
   protected field; a member passes; a non-member is denied; an expired session
   is treated as anonymous.
3. **WS auth** — a subscription without a valid session is refused at handshake;
   a valid one receives events; logout mid-session stops delivery.
4. **E2E smoke (Playwright)** — sign up, create a board, sign out, confirm the
   board is not reachable while signed out.

### Invariants to assert

- [ ] **No anonymous write** — every board mutation requires a valid session.
- [ ] **No anonymous subscribe** — live channels reject unauthenticated sockets.
- [ ] **Ownership** — a non-member can neither read nor write another user's board.
- [ ] **Revocation** — logout / expiry immediately ends access on HTTP *and* WS.

---

## 5. Phased plan

- [ ] **P0 — Decide & spec.** Confirm Postgres + session-cookie authn; lock the
      data model above; decide the migration tool.
- [ ] **P1 — Storage.** Postgres + migrations; `users` / `sessions` tables; wire
      a DB pool into the server. No behavior change yet.
- [ ] **P2 — Authn.** `signup` / `login` / `logout` + password hashing + session
      cookie + `currentUser` in resolver context. HTTP only.
- [ ] **P3 — WS auth.** Validate the session on the subscription handshake; reject
      unauthenticated sockets. Closes the open-subscription hole.
- [ ] **P4 — Boards per user.** `boards` / `memberships`; `requireMember` guard on
      every board-scoped resolver; "my boards" list on the client.
- [ ] **P5 — Auth UI.** Sign-in / sign-up screens; Apollo cookie + WS param wiring;
      401 handling; auth gate around the board.
- [ ] **P6 — Tests & E2E smoke.** The invariants above.

Cursor labels (a name in presence, no password) ship **before** P0 as a
standalone feature — it's the low-cost first taste of identity and slots cleanly
into P2 later, when the name starts coming from the user record.

---

## 6. Open questions

- **Session cookie vs JWT?** Cookie is simpler to revoke and attach to the WS
  handshake; JWT is stateless but harder to invalidate. Leaning cookie.
- **Roll our own authn vs a provider** (e.g. an OAuth/OIDC service)? Own keeps the
  backend self-contained and is a better portfolio story; a provider is faster but
  externalizes the interesting part.
- **Guest / anonymous boards** — keep a "no sign-in, shareable link" mode
  alongside accounts, or require sign-in for everything?
- **Persist shapes now or later?** Storage lands in P1; migrating shapes off
  in-memory is tempting to fold in but is arguably a separate effort.
- **Share model** — invite by email, or shareable link with an embedded role?

---

See also:
[CONFLICT_RESOLUTION_PLAN.md](./CONFLICT_RESOLUTION_PLAN.md) and
[REALTIME_TRANSIENT_SYNC_ARCHITECTURE.md](./REALTIME_TRANSIENT_SYNC_ARCHITECTURE.md)
for the collaboration layers this sits on top of.
