import { describe, it, expect } from "vitest";
import { PresenceManager } from "./PresenceManager";

describe("PresenceManager", () => {
  it("stores and returns a cursor", () => {
    const pm = new PresenceManager();
    pm.setCursor("a", 10, 20, 0);
    expect(pm.getCursors()).toEqual([{ clientId: "a", x: 10, y: 20 }]);
  });

  it("overwrites the previous cursor of the same client", () => {
    const pm = new PresenceManager();
    pm.setCursor("a", 1, 1, 0);
    pm.setCursor("a", 5, 6, 10);
    expect(pm.getCursors()).toEqual([{ clientId: "a", x: 5, y: 6 }]);
  });

  it("drops cursors past the TTL and reports the change", () => {
    const pm = new PresenceManager(5000);
    pm.setCursor("a", 0, 0, 0);
    expect(pm.sweepExpired(5000)).toBe(false);
    expect(pm.sweepExpired(5001)).toBe(true);
    expect(pm.getCursors()).toEqual([]);
  });

  it("keeps fresh cursors while sweeping stale ones", () => {
    const pm = new PresenceManager(5000);
    pm.setCursor("a", 0, 0, 0);
    pm.setCursor("b", 1, 1, 4000);
    expect(pm.sweepExpired(5001)).toBe(true);
    expect(pm.getCursors()).toEqual([{ clientId: "b", x: 1, y: 1 }]);
  });

  it("reports no change when nothing expired", () => {
    const pm = new PresenceManager(5000);
    pm.setCursor("a", 0, 0, 0);
    expect(pm.sweepExpired(100)).toBe(false);
  });
});
