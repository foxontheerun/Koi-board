import { describe, it, expect } from "vitest";
import { DragController } from "./DragController";
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

describe("DragController", () => {
  it("marks shapes as dragging on begin", () => {
    const s = shape({ id: "a" });
    const dc = new DragController();

    dc.begin([s], { x: 0, y: 0 });

    expect(s.state).toBe("dragging");
    expect(dc.isDragging()).toBe(true);
  });

  it("moves a shape by the pointer delta", () => {
    const s = shape({ id: "a", x: 100, y: 100 });
    const dc = new DragController();

    dc.begin([s], { x: 130, y: 140 });
    dc.update({ x: 200, y: 200 });

    expect(s.x).toBe(170);
    expect(s.y).toBe(160);
  });

  it("preserves relative positions when dragging several shapes", () => {
    const a = shape({ id: "a", x: 0, y: 0 });
    const b = shape({ id: "b", x: 50, y: 30 });
    const dc = new DragController();

    dc.begin([a, b], { x: 0, y: 0 });
    dc.update({ x: 100, y: 100 });

    expect(a.x).toBe(100);
    expect(a.y).toBe(100);
    expect(b.x - a.x).toBe(50); // gap kept
    expect(b.y - a.y).toBe(30);
  });

  it("resets state and stops dragging on end", () => {
    const s = shape({ id: "a" });
    const dc = new DragController();

    dc.begin([s], { x: 0, y: 0 });
    const final = dc.end();

    expect(s.state).toBe("static");
    expect(dc.isDragging()).toBe(false);
    expect(final.map((x) => x.id)).toEqual(["a"]);
  });

  it("returns an empty array on update with no active drag", () => {
    const dc = new DragController();

    expect(dc.update({ x: 10, y: 10 })).toEqual([]);
  });
});
