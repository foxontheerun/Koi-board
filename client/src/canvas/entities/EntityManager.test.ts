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
      remote({ id: "low", x: 0, y: 0, width: 100, height: 100, orderKey: "A" }),
      remote({ id: "high", x: 0, y: 0, width: 100, height: 100, orderKey: "F" }),
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

describe("EntityManager.nextOrderKey", () => {
  it("puts a new shape above its siblings", () => {
    const em = managerWith([remote({ id: "a" }), remote({ id: "b", orderKey: "H" })]);

    expect(em.nextOrderKey() > "H").toBe(true);
  });

  it("starts somewhere in the middle on an empty board", () => {
    expect(new EntityManager().nextOrderKey()).toBeTruthy();
  });

  // Keys are only ever compared between siblings, so a child's key says
  // nothing about where it sits relative to a shape outside its group - the
  // tree does. A new member lands on top of the group, still under nothing else.
  it("orders against the siblings inside a group, not the whole board", () => {
    const em = managerWith([
      remote({ id: "g", orderKey: "A" }),
      remote({ id: "top", orderKey: "Z" }),
      remote({ id: "inside", parentId: "g", orderKey: "B" }),
    ]);

    const key = em.nextOrderKey("g");
    expect(key > "B").toBe(true);

    em.addShape({
      ...em.getById("inside")!,
      id: "newest",
      parentId: "g",
      orderKey: key,
    });
    expect(em.getShapes().map((s) => s.id)).toEqual([
      "g",
      "inside",
      "newest",
      "top",
    ]);
  });
});

describe("EntityManager.getShapesOnDragLayer", () => {
  it("is empty when nothing is moving", () => {
    const em = managerWith([remote({ id: "a" })]);

    expect(em.getShapesOnDragLayer()).toEqual([]);
  });

  it("lifts higher-z shapes onto the drag layer for a remote-dragged shape", () => {
    const em = managerWith([
      remote({ id: "low", orderKey: "A" }),
      remote({ id: "high", orderKey: "F" }),
    ]);
    em.applyTransientPatch({ id: "low", x: 10, y: 10 });

    const ids = em.getShapesOnDragLayer().map((s) => s.id);
    expect(ids).toContain("low");
    expect(ids).toContain("high");
  });

  it("excludes lower-z shapes from the drag layer", () => {
    const em = managerWith([
      remote({ id: "low", orderKey: "A" }),
      remote({ id: "mid", orderKey: "F" }),
    ]);
    em.applyTransientPatch({ id: "mid", x: 10, y: 10 });

    const ids = em.getShapesOnDragLayer().map((s) => s.id);
    expect(ids).toContain("mid");
    expect(ids).not.toContain("low");
  });

  it("keeps selected (not dragging) shapes off the drag layer", () => {
    const em = managerWith([remote({ id: "a" })]);
    const shape = em.getById("a");
    if (shape) shape.state = "selected";

    expect(em.getShapesOnDragLayer()).toEqual([]);
  });
});

describe("EntityManager z-order", () => {
  const threeShapes = () =>
    managerWith([
      remote({ id: "a", orderKey: "A" }),
      remote({ id: "b", orderKey: "B" }),
      remote({ id: "c", orderKey: "C" }),
    ]);
  const order = (em: EntityManager) => em.getShapes().map((s) => s.id);

  it("bringToFront moves a shape above all others", () => {
    const em = threeShapes();
    em.bringToFront(["a"]);
    expect(order(em)).toEqual(["b", "c", "a"]);
  });

  it("sendToBack moves a shape below all others", () => {
    const em = threeShapes();
    em.sendToBack(["c"]);
    expect(order(em)).toEqual(["c", "a", "b"]);
  });

  it("moveForward swaps with the next shape up", () => {
    const em = threeShapes();
    em.moveForward(["a"]);
    expect(order(em)).toEqual(["b", "a", "c"]);
  });

  it("moveBackward swaps with the next shape down", () => {
    const em = threeShapes();
    em.moveBackward(["c"]);
    expect(order(em)).toEqual(["a", "c", "b"]);
  });

  it("moveForward on the top shape is a no-op", () => {
    const em = threeShapes();
    expect(em.moveForward(["c"])).toEqual([]);
    expect(order(em)).toEqual(["a", "b", "c"]);
  });

  it("returns nothing for an unknown id", () => {
    const em = threeShapes();
    expect(em.bringToFront(["zzz"])).toEqual([]);
  });
});

describe("EntityManager z-order (multiple shapes)", () => {
  const fourShapes = () =>
    managerWith([
      remote({ id: "a", orderKey: "A" }),
      remote({ id: "b", orderKey: "B" }),
      remote({ id: "c", orderKey: "C" }),
      remote({ id: "d", orderKey: "D" }),
    ]);
  const order = (em: EntityManager) => em.getShapes().map((s) => s.id);

  it("bringToFront keeps the selection's relative order on top", () => {
    const em = fourShapes();
    em.bringToFront(["c", "a"]);
    expect(order(em)).toEqual(["b", "d", "a", "c"]);
  });

  it("sendToBack keeps the selection's relative order at the bottom", () => {
    const em = fourShapes();
    em.sendToBack(["d", "b"]);
    expect(order(em)).toEqual(["b", "d", "a", "c"]);
  });

  it("moveForward steps a contiguous group up without splitting it", () => {
    const em = fourShapes();
    em.moveForward(["a", "b"]);
    expect(order(em)).toEqual(["c", "a", "b", "d"]);
  });

  it("moveForward steps a scattered group over its neighbours", () => {
    const em = fourShapes();
    em.moveForward(["a", "c"]);
    expect(order(em)).toEqual(["b", "a", "d", "c"]);
  });

  it("moveBackward steps a scattered group down over its neighbours", () => {
    const em = fourShapes();
    em.moveBackward(["b", "d"]);
    expect(order(em)).toEqual(["b", "a", "d", "c"]);
  });
});

describe("EntityManager.removeShape", () => {
  it("removes a shape and reports success", () => {
    const em = managerWith([remote({ id: "a" }), remote({ id: "b" })]);

    expect(em.removeShape("a")).toBe(true);
    expect(em.getById("a")).toBeNull();
    expect(em.getShapes().map((s) => s.id)).toEqual(["b"]);
  });

  it("returns false for an unknown id", () => {
    const em = managerWith([remote({ id: "a" })]);

    expect(em.removeShape("zzz")).toBe(false);
    expect(em.getById("a")).not.toBeNull();
  });
});

describe("EntityManager.setLocked", () => {
  it("locks the given shapes and returns the changed ones", () => {
    const em = managerWith([remote({ id: "a" }), remote({ id: "b" })]);

    const changed = em.setLocked(["a", "b"], true);

    expect(changed.map((s) => s.id)).toEqual(["a", "b"]);
    expect(em.getById("a")?.locked).toBe(true);
    expect(em.getById("b")?.locked).toBe(true);
  });

  it("skips shapes already in the requested state", () => {
    const em = managerWith([remote({ id: "a" }), remote({ id: "b" })]);
    em.setLocked(["a"], true);

    const changed = em.setLocked(["a", "b"], true);

    expect(changed.map((s) => s.id)).toEqual(["b"]);
  });
});

describe("EntityManager scene tree", () => {
  const grouped = () =>
    managerWith([
      remote({ id: "under", orderKey: "A" }),
      remote({ id: "group", orderKey: "B", type: "GROUP" }),
      remote({ id: "second", parentId: "group", orderKey: "C" }),
      remote({ id: "first", parentId: "group", orderKey: "B" }),
      remote({ id: "over", orderKey: "C" }),
    ]);
  const order = (em: EntityManager) => em.getShapes().map((s) => s.id);

  it("paints a group followed by what it owns, in key order", () => {
    expect(order(grouped())).toEqual(["under", "group", "first", "second", "over"]);
  });

  it("lists the children of a group", () => {
    expect(grouped().childrenOf("group").map((s) => s.id)).toEqual(["first", "second"]);
  });

  it("returns a shape with everything below it", () => {
    const em = managerWith([
      remote({ id: "outer", orderKey: "A" }),
      remote({ id: "inner", parentId: "outer", orderKey: "A" }),
      remote({ id: "leaf", parentId: "inner", orderKey: "A" }),
      remote({ id: "elsewhere", orderKey: "B" }),
    ]);

    expect(em.subtreeOf("outer").map((s) => s.id).sort()).toEqual([
      "inner",
      "leaf",
      "outer",
    ]);
  });

  it("walks up to the outermost group, however deep the shape sits", () => {
    const em = managerWith([
      remote({ id: "outer", orderKey: "A" }),
      remote({ id: "inner", parentId: "outer", orderKey: "A" }),
      remote({ id: "leaf", parentId: "inner", orderKey: "A" }),
    ]);

    expect(em.outermostAncestorOf("leaf")?.id).toBe("outer");
    expect(em.outermostAncestorOf("outer")?.id).toBe("outer");
  });

  // The board is never allowed to hide a shape: a parent that never arrived,
  // or a cycle that slipped past the server, still has to be painted.
  it("treats a shape whose parent never arrived as a root", () => {
    const em = managerWith([
      remote({ id: "orphan", parentId: "never-sent", orderKey: "A" }),
      remote({ id: "plain", orderKey: "B" }),
    ]);

    expect(order(em)).toEqual(["orphan", "plain"]);
  });

  it("still paints shapes caught in a cycle", () => {
    const em = managerWith([
      remote({ id: "a", parentId: "b", orderKey: "A" }),
      remote({ id: "b", parentId: "a", orderKey: "B" }),
      remote({ id: "sane", orderKey: "C" }),
    ]);

    expect(order(em).sort()).toEqual(["a", "b", "sane"]);
  });

  it("reorders a child among its siblings, not against the whole board", () => {
    const em = grouped();
    em.bringToFront(["first"]);

    expect(order(em)).toEqual(["under", "group", "second", "first", "over"]);
  });

  it("lifts a whole group onto the drag layer, never half of it", () => {
    const em = grouped();
    em.applyTransientPatch({ id: "group", x: 10, y: 10 });

    const ids = em.getShapesOnDragLayer().map((s) => s.id);
    expect(ids).toEqual(["group", "first", "second", "over"]);
  });
});

// On the wire a child is positioned relative to its parent - that is what makes
// dragging a group one message. The scene works in world coordinates, so the
// conversion has to survive a load, an event and a transient move alike.
describe("EntityManager child coordinates", () => {
  const withGroup = () =>
    managerWith([
      remote({ id: "group", x: 100, y: 100, orderKey: "A", type: "GROUP" }),
      remote({ id: "child", x: 10, y: 5, parentId: "group", orderKey: "A" }),
    ]);

  it("places a child relative to its parent on load", () => {
    const child = withGroup().getById("child");

    expect(child?.x).toBe(110);
    expect(child?.y).toBe(105);
  });

  it("converts back to the parent's frame on the way out", () => {
    const em = withGroup();

    expect(em.localPositionOf(em.getById("child")!)).toEqual({ x: 10, y: 5 });
  });

  it("leaves a root shape's coordinates alone in both directions", () => {
    const em = withGroup();

    expect(em.localPositionOf(em.getById("group")!)).toEqual({ x: 100, y: 100 });
  });

  it("carries the members when a group is dragged by someone else", () => {
    const em = withGroup();
    em.applyTransientPatch({ id: "group", x: 150, y: 120 });

    expect(em.getById("child")?.x).toBe(160);
    expect(em.getById("child")?.y).toBe(125);
  });

  it("carries the members when a group move is persisted", () => {
    const em = withGroup();
    em.applyShapeEvent({
      type: "UPDATED",
      shape: remote({ id: "group", x: 200, y: 100, orderKey: "A" }),
    });

    expect(em.getById("child")?.x).toBe(210);
    expect(em.getById("child")?.y).toBe(105);
  });

  it("places a newly created child relative to its parent", () => {
    const em = withGroup();
    em.applyShapeEvent({
      type: "CREATED",
      shape: remote({ id: "fresh", x: 20, y: 20, parentId: "group", orderKey: "B" }),
    });

    expect(em.getById("fresh")?.x).toBe(120);
  });
});
