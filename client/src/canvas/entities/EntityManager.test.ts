import { describe, it, expect } from "vitest";
import { EntityManager, type RemoteShape } from "./EntityManager";

const remote = (over: Partial<RemoteShape> & { id: string }): RemoteShape => ({
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  ...over,
});

// replaceAll gives the instance its own array with a known state,
// instead of the shared module-level defaults.
const managerWith = (shapes: RemoteShape[]) => {
  const em = new EntityManager();
  em.replaceAll(shapes);
  return em;
};

describe("EntityManager.findShapeAt", () => {
  it("returns the topmost shape when shapes overlap", () => {
    const em = managerWith([
      remote({ id: "low", x: 0, y: 0, width: 100, height: 100, zIndex: 0 }),
      remote({ id: "high", x: 0, y: 0, width: 100, height: 100, zIndex: 5 }),
    ]);

    expect(em.findShapeAt({ x: 50, y: 50 })?.id).toBe("high");
  });

  it("returns null when the point is outside every shape", () => {
    const em = managerWith([
      remote({ id: "a", x: 0, y: 0, width: 100, height: 100 }),
    ]);

    expect(em.findShapeAt({ x: 500, y: 500 })).toBeNull();
  });

  it("includes points within the margin", () => {
    const em = managerWith([
      remote({ id: "a", x: 0, y: 0, width: 100, height: 100 }),
    ]);

    expect(em.findShapeAt({ x: 110, y: 50 })).toBeNull();
    expect(em.findShapeAt({ x: 110, y: 50 }, 20)?.id).toBe("a");
  });
});

describe("EntityManager.findShapesInRect", () => {
  it("returns shapes fully inside the rect", () => {
    const em = managerWith([
      remote({ id: "a", x: 20, y: 20, width: 30, height: 30 }),
    ]);
    const found = em.findShapesInRect({ x: 0, y: 0, width: 100, height: 100 });
    expect(found.map((s) => s.id)).toContain("a");
  });

  it("returns shapes partially overlapping the rect", () => {
    const em = managerWith([
      remote({ id: "a", x: 80, y: 20, width: 100, height: 30 }),
    ]);
    const found = em.findShapesInRect({ x: 0, y: 0, width: 100, height: 100 });
    expect(found.map((s) => s.id)).toContain("a");
  });

  it("excludes shapes outside the rect", () => {
    const em = managerWith([
      remote({ id: "a", x: 500, y: 500, width: 30, height: 30 }),
    ]);
    const found = em.findShapesInRect({ x: 0, y: 0, width: 100, height: 100 });
    expect(found.map((s) => s.id)).not.toContain("a");
  });

  it("works regardless of drag direction (rect with negative size)", () => {
    const em = managerWith([
      remote({ id: "a", x: 20, y: 20, width: 30, height: 30 }),
    ]);
    const found = em.findShapesInRect({
      x: 100,
      y: 100,
      width: -100,
      height: -100,
    });
    expect(found.map((s) => s.id)).toContain("a");
  });
});

describe("EntityManager.applyShapeEvent", () => {
  it("removes a shape on DELETED", () => {
    const em = managerWith([remote({ id: "a" }), remote({ id: "b" })]);

    em.applyShapeEvent({ type: "DELETED", shape: remote({ id: "a" }) });

    expect(em.getById("a")).toBeNull();
    expect(em.getById("b")).not.toBeNull();
  });

  it("adds a new shape on CREATED", () => {
    const em = managerWith([remote({ id: "a" })]);
    em.applyShapeEvent({
      type: "CREATED",
      shape: remote({ id: "b", x: 200, y: 200 }),
    });
    expect(em.getById("b")).not.toBeNull();
  });

  it("merges into the existing shape on UPDATED", () => {
    const em = managerWith([remote({ id: "a", x: 0, y: 0 })]);
    em.applyShapeEvent({
      type: "UPDATED",
      shape: remote({ id: "a", x: 300, y: 400 }),
    });
    const shape = em.getById("a");
    expect(shape?.x).toBe(300);
    expect(shape?.y).toBe(400);
  });

  it("resets remote-dragging back to static on UPDATED", () => {
    const em = managerWith([remote({ id: "a" })]);
    em.applyTransientPatch({ id: "a", x: 10, y: 10 });
    em.applyShapeEvent({
      type: "UPDATED",
      shape: remote({ id: "a", x: 20, y: 20 }),
    });
    expect(em.getById("a")?.state).toBe("static");
  });
});

describe("EntityManager.applyTransientPatch", () => {
  it("updates the shape position from the patch", () => {
    const em = managerWith([remote({ id: "a", x: 0, y: 0 })]);

    em.applyTransientPatch({ id: "a", x: 50, y: 60 });

    const shape = em.getById("a");
    expect(shape?.x).toBe(50);
    expect(shape?.y).toBe(60);
  });

  it("returns becameRemote=true on the first transition to remote-dragging", () => {
    const em = managerWith([remote({ id: "a", x: 0, y: 0 })]);
    const { becameRemote } = em.applyTransientPatch({ id: "a", x: 50, y: 60 });
    expect(becameRemote).toBe(true);
  });

  it("returns becameRemote=false while already remote-dragging", () => {
    const em = managerWith([remote({ id: "a", x: 0, y: 0 })]);
    const patch = { id: "a", x: 50, y: 60 };

    em.applyTransientPatch(patch);

    const { becameRemote } = em.applyTransientPatch(patch);
    expect(becameRemote).toBe(false);
  });

  it("returns becameRemote=false for an unknown id", () => {
    const em = managerWith([remote({ id: "a" })]);

    const { becameRemote } = em.applyTransientPatch({
      id: "zzz",
      x: 10,
      y: 10,
    });

    expect(becameRemote).toBe(false);
  });
});

describe("EntityManager z-index", () => {
  it("getMaxZIndex returns the highest zIndex", () => {
    const em = managerWith([
      remote({ id: "a", zIndex: 2 }),
      remote({ id: "b", zIndex: 7 }),
      remote({ id: "c", zIndex: 4 }),
    ]);

    expect(em.getMaxZIndex()).toBe(7);
  });

  it("getMinZIndex returns the lowest zIndex", () => {
    const em = managerWith([
      remote({ id: "a", zIndex: 2 }),
      remote({ id: "b", zIndex: 7 }),
      remote({ id: "c", zIndex: 4 }),
    ]);

    expect(em.getMinZIndex()).toBe(2);
  });
});
