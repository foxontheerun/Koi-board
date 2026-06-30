import { describe, it, expect } from "vitest";
import { groupManipulationBounds } from "./Overlay";
import type { _Shape } from "../../entities";

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

describe("groupManipulationBounds", () => {
  it("wraps positive-size shapes", () => {
    const bounds = groupManipulationBounds([
      shape({ id: "a", x: 0, y: 0, width: 50, height: 50 }),
      shape({ id: "b", x: 100, y: 100, width: 50, height: 50 }),
    ]);
    expect(bounds).toEqual({ x: 0, y: 0, w: 150, h: 150 });
  });

  it("handles negative width/height", () => {
    const bounds = groupManipulationBounds([
      shape({ id: "a", x: 0, y: 0, width: 50, height: 50 }),
      shape({ id: "b", x: 200, y: 200, width: -50, height: -50 }),
    ]);
    expect(bounds).toEqual({ x: 0, y: 0, w: 200, h: 200 });
  });
});
