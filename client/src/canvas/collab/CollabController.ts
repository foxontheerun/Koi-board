// collab/CollabController.ts
import type { EntityManager } from "../entities";
import { LockManager } from "./LockManager";
import { PresenceManager } from "./PresenceManager";
import type { LockAction } from "./types";
import type { RemoteCursor } from "../types";

interface CollabCallbacks {
  onLocalLock: (shapeId: string, action: LockAction) => void;
  onRemoteCursors: (cursors: RemoteCursor[]) => void;
}

export class CollabController {
  private lockManager = new LockManager();
  private presenceManager = new PresenceManager();
  private clientId: string | null = null;

  constructor(
    private readonly entityManager: EntityManager,
    private readonly callbacks: CollabCallbacks,
  ) {}

  setClientId(clientId: string) {
    this.clientId = clientId;
  }

  acquire(ids: string[]) {
    if (!this.clientId) return;
    const now = Date.now();
    ids.forEach((id) => {
      if (this.lockManager.acquire(id, this.clientId!, now)) {
        this.callbacks.onLocalLock(id, "ACQUIRE");
      }
    });
  }

  renew(ids: string[]) {
    if (!this.clientId) return;
    const now = Date.now();
    ids.forEach((id) => this.lockManager.renew(id, this.clientId!, now));
  }

  release(ids: string[]) {
    if (!this.clientId) return;
    ids.forEach((id) => {
      this.lockManager.release(id, this.clientId!);
      this.callbacks.onLocalLock(id, "RELEASE");
    });
  }

  applyRemoteLock(shapeId: string, clientId: string, action: LockAction) {
    if (action === "ACQUIRE") {
      this.lockManager.acquire(shapeId, clientId, Date.now());
    } else {
      this.lockManager.release(shapeId, clientId);
    }
  }

  renewRemoteLock(shapeId: string, clientId: string) {
    this.lockManager.acquire(shapeId, clientId, Date.now());
  }

  isLockedByOther(shapeId: string): boolean {
    if (!this.clientId) return false;
    return this.lockManager.isLockedByOther(shapeId, this.clientId, Date.now());
  }

  ownsShape(shapeId: string): boolean {
    if (!this.clientId) return false;
    return this.lockManager.getOwner(shapeId, Date.now()) === this.clientId;
  }

  applyRemoteCursor(clientId: string, x: number, y: number) {
    this.presenceManager.setCursor(clientId, x, y, Date.now());
    this.callbacks.onRemoteCursors(this.presenceManager.getCursors());
  }

  sweep(): { shapesChanged: boolean } {
    const now = Date.now();
    this.lockManager.sweepExpired(now);

    let shapesChanged = false;
    for (const shape of this.entityManager.getShapes()) {
      if (
        shape.state === "remote-dragging" &&
        this.lockManager.getOwner(shape.id, now) === null
      ) {
        shape.state = "static";
        shapesChanged = true;
      }
    }

    if (this.presenceManager.sweepExpired(now)) {
      this.callbacks.onRemoteCursors(this.presenceManager.getCursors());
    }

    return { shapesChanged };
  }
}
