import type { RemoteCursor } from "../types";

export const DEFAULT_CURSOR_TTL_MS = 5000;

interface PresenceEntry {
  x: number;
  y: number;
  lastSeen: number;
}

export class PresenceManager {
  private cursors = new Map<string, PresenceEntry>();
  private readonly ttlMs: number;

  constructor(ttlMs = DEFAULT_CURSOR_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  setCursor(clientId: string, x: number, y: number, now: number): void {
    this.cursors.set(clientId, { x, y, lastSeen: now });
  }

  sweepExpired(now: number): boolean {
    let changed = false;
    for (const [clientId, entry] of this.cursors) {
      if (now - entry.lastSeen > this.ttlMs) {
        this.cursors.delete(clientId);
        changed = true;
      }
    }
    return changed;
  }

  getCursors(): RemoteCursor[] {
    const cursors: RemoteCursor[] = [];
    for (const [clientId, entry] of this.cursors) {
      cursors.push({ clientId, x: entry.x, y: entry.y });
    }
    return cursors;
  }
}
