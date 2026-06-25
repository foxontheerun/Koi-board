# Conflict Resolution — Work Plan

How we will build conflict handling for concurrent shape manipulation
(multiple users dragging/resizing the same board at the same time).

> Status: in progress — see Progress below.

---

## Progress (state of play)

Decision: **soft-lock + LWW** (chosen over full Figma-style server ordering; see §2).

Branch `feat/lock-manager` (has master merged in for the z-order fix):

Done — **locks work across clients** (verified live on two tabs):
- **P1 ✅** `LockManager` pure module + 18 unit tests (`client/src/canvas/collab/`).
- **P2 ✅** wired into `BoardRuntime`: acquire on drag start, renew per frame,
  release on mouse up, and skip incoming transient patches for shapes the local
  client holds.
- **P3 ✅** server (`setShapeLock` / `shapeLocks` + `server/locks` pub/sub) and
  client (gql docs, broadcast ACQUIRE/RELEASE, shared `LockManager` fed by the
  `shapeLocks` subscription, and a grab guard in `handleMouseDown`). Renew is
  piggybacked on the transient stream so a held shape survives a long drag.

Next:
- **P4 (partial) ⏳** — piggyback renew done; still missing an explicit
  `sweepExpired` on a timer / disconnect (currently self-heals lazily via the
  lease, since queries treat expired locks as free).
- **P5 / P6 ⏳** convergence simulation tests; Playground/Playwright smoke.
- **Nice-to-have** — visual "locked by someone else" indicator.

Notes:
- To run the lock server: restart `go run ./cmd/api`. To re-run gqlgen codegen on
  a fresh clone, run `go get github.com/99designs/gqlgen` once first.
- Separate render follow-up (not locks): remote drag still full-clears every
  frame. Clipping it to the dirty rect needs `remote-dragging` included in the
  dirty-rect set AND a fix for the zoom-invalidation artifact (an earlier attempt
  left stale content on zoom).

---

## 1. Problem

Today there is **no conflict resolution**. The transient flow just overwrites:
`EntityManager.applyTransientPatch` sets the incoming x/y/width/height and marks
the shape `remote-dragging`, last message wins.

What actually conflicts:

- **Different users → different shapes** — not a conflict. Independent movement,
  only a throughput concern (already helped by batching + dirty rect).
- **Two users → the SAME shape** — the real conflict. Each client applies the
  other's patches, so the shape "fights" between two positions every frame.

Scope of this work = the second case (same shape, concurrent manipulation),
plus making the final committed state deterministic.

---

## 2. Chosen strategy

**Soft-lock during active manipulation + last-write-wins (LWW) for the commit.**

- While a user is actively dragging/resizing a shape, they **own** it. Other
  clients' transient patches for that shape are ignored until release.
- On release (mouseup), the owner commits the final value (persisted event).
  If somehow two commits race, the later timestamp wins (LWW with clientId
  tiebreak).

Why this over the alternatives:

| Option | Fights during drag? | Notes |
|---|---|---|
| Pure LWW | yes (position oscillates) | simplest, but bad UX |
| LWW-register (CRDT) | yes visually | converges, still oscillates live |
| **Soft-lock + LWW commit** | **no** | Miro/Figma-style, removes the fight at the source |

The lock is **soft**: it's a UX coordination mechanism, not a security boundary.
It must self-heal (lease timeout) so a disconnected client can't freeze a shape.

### Why both (lock and LWW)?

They cover different things: the lock is **live UX**, LWW is **final correctness**.

Because the lock is soft and self-healing, there's no central guarantee of a
single owner, so edge cases still produce two commits for one shape — e.g. a
**lease race**:

1. A drags a shape and holds the lock.
2. A's network stalls → the lease expires for everyone else.
3. B sees the shape free, drags it, commits `(100, 100)`.
4. A reconnects and also commits its final `(0, 0)`.

Two final values arrive. Without a tiebreak, clients could settle on different
positions → **divergence** (boards drift apart), the worst outcome for collab.
LWW (`timestamp`, `clientId` tiebreak) picks a deterministic winner so everyone
**re-converges**. The same need shows up on a dropped `release` or a
near-simultaneous `acquire`.

In short: the lock removes the fight in the common case; LWW is the consistency
backstop at the edges where a soft lock can't hold.

---

## 3. Design

Keep the policy as a **pure, testable state machine**, separate from
`EntityManager` and rendering.

### `LockManager` (new, pure)

```ts
type Lock = { shapeId: string; clientId: string; expiresAt: number };

interface LockManager {
  acquire(shapeId: string, clientId: string, now: number): boolean; // false if held by other
  release(shapeId: string, clientId: string): void;
  renew(shapeId: string, clientId: string, now: number): void;      // heartbeat while dragging
  isLockedByOther(shapeId: string, clientId: string, now: number): boolean;
  sweepExpired(now: number): void;                                   // drop stale leases
}
```

- `now` is passed in (no `Date.now()` inside) so tests are deterministic.
- Leases expire (e.g. 3s); an active dragger renews on each frame.

### Integration points

1. **Drag/resize start** → `acquire(shapeId, myClientId)`; broadcast a lock event.
2. **Incoming transient patch** → guard in the apply path:
   `if (lockManager.isLockedByOther(id, myId, now)) skip`.
3. **Each drag frame** → `renew` + broadcast (piggyback on the transient batch).
4. **Drag/resize end** → `release` + broadcast + commit persisted value.
5. **Disconnect / timeout** → `sweepExpired` frees the shape.

### Protocol additions (server)

- Carry lock intent on the transient stream (e.g. `acquire` / `release` flags
  or dedicated lock events) with `clientId` and a `leaseMs`.
- Reuse the existing `clientID` echo-suppression.
- (Optional, later) `dragSessionId + seq` from the transient-sync doc to drop
  out-of-order frames.

---

## 4. Testing strategy

Concurrency is **not** primarily tested with two real browsers (slow, flaky,
non-deterministic ordering). Layers:

1. **Unit** — `LockManager` as a state machine: acquire/release/expire/contention.
2. **Deterministic multi-client simulation** — N in-memory clients + a fake
   transport; feed interleaved/out-of-order events; assert **convergence**
   (all clients end in the same state) for any delivery order.
3. **E2E smoke (Playwright)** — 2 browser contexts, a couple of "two users drag
   the same shape" scenarios for live confidence. Not for exhaustive logic.

### Invariants to assert

- [ ] **Convergence** — any delivery order → identical final state on all clients.
- [ ] **No-fight** — while A owns a shape, B's transient patches don't move it.
- [ ] **Lock release** — after mouseup / timeout / disconnect the shape is free
      again (no permanent freeze).
- [ ] **Independence** — concurrent drag of *different* shapes never interferes.

---

## 5. Phased plan

- [x] **P0 — Decide & spec.** Soft-lock + LWW; default lease 3000ms; lock events on the wire.
- [x] **P1 — `LockManager`** pure module + unit tests (acquire/release/expire/contention).
- [x] **P2 — Apply-path guard.** Wired into `BoardRuntime`: lifecycle + skip transient
      patches for shapes the local client holds.
- [x] **P3 — Protocol.** Server (`setShapeLock` + `shapeLocks`) and client (gateway
      send/subscribe + shared `LockManager` + grab guard). Locks work across clients.
- [~] **P4 — Lifecycle.** Renew piggybacked on transient (done); explicit
      `sweepExpired` on a timer / disconnect still pending.
- [ ] **P5 — Simulation tests.** Multi-client convergence harness + the 4 invariants.
- [ ] **P6 — E2E smoke.** Playwright, two contexts, same-shape contention.

---

## 6. Open questions

- Lease duration vs renew frequency (balance freeze-risk vs network chatter)?
- Should resize and drag share one lock per shape (yes, most likely)?
- What does the non-owner see while a shape is locked — live remote ghost, or
  just the last position until commit?
- Do we need `dragSessionId + seq` ordering now, or is the lock enough?

---

See also: [REALTIME_TRANSIENT_SYNC_ARCHITECTURE.md](./REALTIME_TRANSIENT_SYNC_ARCHITECTURE.md)
for the transient stream design this builds on.
