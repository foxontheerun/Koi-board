export interface ShapeLock {
  shapeId: string;
  clientId: string;
  acquiredAt: number;
  expiresAt: number;
}

export type LockAction = "ACQUIRE" | "RELEASE";
