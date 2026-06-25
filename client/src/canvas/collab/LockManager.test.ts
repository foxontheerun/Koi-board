import { describe, it, expect } from "vitest";
import { LockManager } from "./LockManager";

describe("LockManager.acquire", () => {
  it("grants a lock on a free shape", () => {
    const lm = new LockManager();

    expect(lm.acquire("s1", "A", 0)).toBe(true);
  });

  it("denies a shape held by another live client", () => {
    const lm = new LockManager(1000);
    lm.acquire("s1", "A", 0);

    expect(lm.acquire("s1", "B", 500)).toBe(false);
  });

  it("grants to the same client (refresh)", () => {
    const lm = new LockManager(1000);
    lm.acquire("s1", "A", 0);

    expect(lm.acquire("s1", "A", 500)).toBe(true);
  });

  it("grants once the previous lock has expired", () => {
    const lm = new LockManager(1000);
    lm.acquire("s1", "A", 0);

    expect(lm.acquire("s1", "B", 1000)).toBe(true);
  });
});

describe("LockManager.getOwner", () => {
  it("returns the owner of a live lock", () => {
    const lm = new LockManager(1000);
    lm.acquire("s1", "A", 0);

    expect(lm.getOwner("s1", 500)).toBe("A");
  });

  it("returns null for a free shape", () => {
    const lm = new LockManager();

    expect(lm.getOwner("s1", 0)).toBeNull();
  });

  it("returns null once the lock has expired", () => {
    const lm = new LockManager(1000);
    lm.acquire("s1", "A", 0);

    expect(lm.getOwner("s1", 1000)).toBeNull();
  });
});

describe("LockManager.isLockedByOther", () => {
  it("is true when held by another live client", () => {
    const lm = new LockManager(1000);
    lm.acquire("s1", "A", 0);

    expect(lm.isLockedByOther("s1", "B", 500)).toBe(true);
  });

  it("is false when held by the same client", () => {
    const lm = new LockManager(1000);
    lm.acquire("s1", "A", 0);

    expect(lm.isLockedByOther("s1", "A", 500)).toBe(false);
  });

  it("is false for a free shape", () => {
    const lm = new LockManager();

    expect(lm.isLockedByOther("s1", "A", 0)).toBe(false);
  });
});

describe("LockManager.renew", () => {
  it("extends the lease for the owner", () => {
    const lm = new LockManager(1000);
    lm.acquire("s1", "A", 0);
    lm.renew("s1", "A", 500);

    expect(lm.getOwner("s1", 1200)).toBe("A");
  });

  it("does nothing for a non-owner", () => {
    const lm = new LockManager(1000);
    lm.acquire("s1", "A", 0);
    lm.renew("s1", "B", 500);

    expect(lm.getOwner("s1", 1200)).toBeNull();
  });

  it("does not revive an already-expired lock", () => {
    const lm = new LockManager(1000);
    lm.acquire("s1", "A", 0);
    lm.renew("s1", "A", 1000);

    expect(lm.getOwner("s1", 1500)).toBeNull();
  });
});

describe("LockManager.release", () => {
  it("frees the shape for its owner", () => {
    const lm = new LockManager(1000);
    lm.acquire("s1", "A", 0);
    lm.release("s1", "A");

    expect(lm.getOwner("s1", 100)).toBeNull();
  });

  it("does nothing for a non-owner", () => {
    const lm = new LockManager(1000);
    lm.acquire("s1", "A", 0);
    lm.release("s1", "B");

    expect(lm.getOwner("s1", 100)).toBe("A");
  });
});

describe("LockManager.sweepExpired", () => {
  it("removes locks whose lease has expired", () => {
    const lm = new LockManager(1000);
    lm.acquire("s1", "A", 0);
    lm.sweepExpired(1000);

    expect(lm.getOwner("s1", 0)).toBeNull();
  });

  it("keeps locks that are still live", () => {
    const lm = new LockManager(1000);
    lm.acquire("s1", "A", 0);
    lm.sweepExpired(500);

    expect(lm.getOwner("s1", 600)).toBe("A");
  });

  it("removes only the expired locks", () => {
    const lm = new LockManager(1000);
    lm.acquire("old", "A", 0);
    lm.acquire("new", "B", 600);
    lm.sweepExpired(1000);

    expect(lm.getOwner("old", 0)).toBeNull();
    expect(lm.getOwner("new", 700)).toBe("B");
  });
});
