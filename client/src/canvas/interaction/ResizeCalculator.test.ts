import { describe, it, expect } from "vitest";
import { ResizeCalculator } from "./ResizeCalculator";
import { ResizeHandles } from "../entities";
import type { _Shape } from "../entities";

// worldPoint is a delta (dx, dy) in world coordinates, not an absolute point.
const baseShape = (): _Shape => ({
  id: "1",
  x: 100,
  y: 100,
  width: 200,
  height: 100,
  fill: "#ffffff",
  stroke: "#000000",
  state: "static",
  type: "RECT",
});

describe("ResizeCalculator.resize", () => {
  it("Right grows width by dx and leaves the rest", () => {
    const result = ResizeCalculator.resize(baseShape(), ResizeHandles.Right, {
      x: 50,
      y: 0,
    });

    expect(result.width).toBe(250);
    expect(result.x).toBe(100);
    expect(result.y).toBe(100);
    expect(result.height).toBe(100);
  });

  it("Left moves x and shrinks width", () => {
    const result = ResizeCalculator.resize(baseShape(), ResizeHandles.Left, {
      x: 50,
      y: 0,
    });

    expect(result.x).toBe(150);
    expect(result.width).toBe(150);
  });

  it("Bottom grows height by dy", () => {
    const result = ResizeCalculator.resize(baseShape(), ResizeHandles.Bottom, {
      x: 0,
      y: 30,
    });

    expect(result.height).toBe(130);
    expect(result.x).toBe(100);
    expect(result.y).toBe(100);
    expect(result.width).toBe(200);
  });

  it("Top moves y and shrinks height", () => {
    const result = ResizeCalculator.resize(baseShape(), ResizeHandles.Top, {
      x: 0,
      y: 30,
    });

    expect(result.y).toBe(130);
    expect(result.height).toBe(70);
  });

  it("TopLeft changes x, y, width and height at once", () => {
    const result = ResizeCalculator.resize(baseShape(), ResizeHandles.TopLeft, {
      x: 50,
      y: 30,
    });

    expect(result.x).toBe(150);
    expect(result.y).toBe(130);
    expect(result.width).toBe(150);
    expect(result.height).toBe(70);
  });

  it("TopRight changes y, height and width (not x)", () => {
    const result = ResizeCalculator.resize(baseShape(), ResizeHandles.TopRight, {
      x: 50,
      y: 30,
    });

    expect(result.y).toBe(130);
    expect(result.height).toBe(70);
    expect(result.width).toBe(250);
    expect(result.x).toBe(100);
  });

  it("BottomLeft changes x, width and height (not y)", () => {
    const result = ResizeCalculator.resize(
      baseShape(),
      ResizeHandles.BottomLeft,
      { x: 50, y: 30 },
    );

    expect(result.x).toBe(150);
    expect(result.width).toBe(150);
    expect(result.height).toBe(130);
    expect(result.y).toBe(100);
  });

  it("BottomRight changes width and height (not x, y)", () => {
    const result = ResizeCalculator.resize(
      baseShape(),
      ResizeHandles.BottomRight,
      { x: 50, y: 30 },
    );

    expect(result.width).toBe(250);
    expect(result.height).toBe(130);
    expect(result.x).toBe(100);
    expect(result.y).toBe(100);
  });

  it("does not mutate the original shape", () => {
    const shape = baseShape();

    ResizeCalculator.resize(shape, ResizeHandles.Right, { x: 50, y: 0 });

    expect(shape.width).toBe(200);
  });

  it("returns an equal shape for a zero delta", () => {
    const result = ResizeCalculator.resize(baseShape(), ResizeHandles.BottomRight, {
      x: 0,
      y: 0,
    });

    expect(result).toEqual(baseShape());
  });

  it("documents that a negative delta can drive width below 0", () => {
    // No clamping: a large negative dx on Right makes width negative.
    const result = ResizeCalculator.resize(baseShape(), ResizeHandles.Right, {
      x: -300,
      y: 0,
    });

    expect(result.width).toBe(-100);
  });
});

describe("ResizeCalculator.getShapeManipulationBounds", () => {
  it("RECT bounds match the shape's x/y/width/height", () => {
    const bounds = ResizeCalculator.getShapeManipulationBounds(baseShape());

    expect(bounds).toEqual({ x: 100, y: 100, w: 200, h: 100 });
  });
});
