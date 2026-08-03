import { describe, it, expect } from "vitest";
import { GroupResizeController } from "./GroupResizeController";
import { ResizeHandles } from "../entities";
import type { _Shape } from "../entities";

const shape = (over: Partial<_Shape> & { id: string }): _Shape => ({
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  orderKey: "V",
  fill: "#ffffff",
  stroke: "#000000",
  state: "static",
  type: "RECT",
  ...over,
});

describe("GroupResizeController", () => {
  it("scales shapes proportionally from the group bbox", () => {
    const a = shape({ id: "a", x: 0, y: 0, width: 100, height: 100 });
    const b = shape({ id: "b", x: 100, y: 100, width: 100, height: 100 });
    const grc = new GroupResizeController();

    // group bbox is 0..200; drag BottomRight by +200,+200 -> bbox 0..400 (x2)
    grc.begin([a, b], ResizeHandles.BottomRight, { x: 0, y: 0 });
    grc.update({ x: 200, y: 200 });

    expect(a).toMatchObject({ x: 0, y: 0, width: 200, height: 200 });
    expect(b).toMatchObject({ x: 200, y: 200, width: 200, height: 200 });
  });

  it("marks shapes resizing on begin and static on end", () => {
    const a = shape({ id: "a" });
    const grc = new GroupResizeController();

    grc.begin([a], ResizeHandles.Right, { x: 0, y: 0 });
    expect(a.state).toBe("resizing");

    grc.end();
    expect(a.state).toBe("static");
  });
});
