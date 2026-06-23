import { describe, it, expect } from "vitest";
import { ResizeController } from "./ResizeController";
import { ResizeHandles } from "../entities";
import type { _Shape } from "../entities";

const shape = (over: Partial<_Shape> & { id: string }): _Shape => ({
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  fill: "#ffffff",
  stroke: "#000000",
  state: "static",
  type: "RECT",
  ...over,
});

describe("ResizeController", () => {
  it("sets the shape to dragging on begin", () => {
    const s = shape({ id: "a" });
    const rc = new ResizeController();

    rc.begin(s, ResizeHandles.Right, { x: 0, y: 0 });

    expect(s.state).toBe("dragging");
  });

  it("resizes by the pointer delta", () => {
    const s = shape({ id: "a", width: 100 });
    const rc = new ResizeController();

    rc.begin(s, ResizeHandles.Right, { x: 0, y: 0 });
    const result = rc.update({ x: 50, y: 0 }); // dx 50 → width +50

    expect(result?.width).toBe(150);
  });

  it("updates the live shape object in place", () => {
    const s = shape({ id: "a", width: 100 });
    const rc = new ResizeController();

    rc.begin(s, ResizeHandles.Right, { x: 0, y: 0 });
    rc.update({ x: 50, y: 0 });

    expect(s.width).toBe(150);
  });

  it("returns null when update is called before begin", () => {
    const rc = new ResizeController();

    expect(rc.update({ x: 10, y: 10 })).toBeNull();
  });

  it("resets the shape to static and returns the final shape on end", () => {
    const s = shape({ id: "a", width: 100 });
    const rc = new ResizeController();

    rc.begin(s, ResizeHandles.Right, { x: 0, y: 0 });
    rc.update({ x: 50, y: 0 });
    const out = rc.end();

    expect(s.state).toBe("static");
    expect(out?.state).toBe("static");
    expect(out?.width).toBe(150);
  });
});
