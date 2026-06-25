import type { ShapeLock } from "./types";

export const DEFAULT_LEASE_MS = 3000;

export class LockManager {
  private locks = new Map<string, ShapeLock>();
  private readonly leaseMs: number;

  constructor(leaseMs = DEFAULT_LEASE_MS) {
    this.leaseMs = leaseMs;
  }

  acquire(shapeId: string, clientId: string, now: number): boolean {
    const live = this.getLive(shapeId, now);

    if (live && live.clientId !== clientId) return false;

    this.locks.set(shapeId, {
      shapeId,
      clientId,
      acquiredAt: live ? live.acquiredAt : now,
      expiresAt: now + this.leaseMs,
    });

    return true;
  }

  getOwner(shapeId: string, now: number): string | null {
    return this.getLive(shapeId, now)?.clientId ?? null;
  }

  isLockedByOther(shapeId: string, clientId: string, now: number): boolean {
    const owner = this.getOwner(shapeId, now);
    return owner !== null && owner !== clientId;
  }

  renew(shapeId: string, clientId: string, now: number): void {
    const live = this.getLive(shapeId, now);
    if (!live || live.clientId !== clientId) return;

    live.expiresAt = now + this.leaseMs;
  }

  release(shapeId: string, clientId: string): void {
    const lock = this.locks.get(shapeId);
    if (lock !== undefined && lock.clientId === clientId) {
      this.locks.delete(shapeId);
    }
  }

  sweepExpired(now: number): void {
    for (const [shapeId, lock] of this.locks) {
      if (lock.expiresAt <= now) this.locks.delete(shapeId);
    }
  }

  private getLive(shapeId: string, now: number): ShapeLock | null {
    const lock = this.locks.get(shapeId);
    return lock !== undefined && lock.expiresAt > now ? lock : null;
  }
}
