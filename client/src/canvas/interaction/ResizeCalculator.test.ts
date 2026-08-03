import { describe, it, expect } from "vitest";
import { ResizeCalculator } from "./ResizeCalculator";
import { ResizeHandles } from "../entities";
import type { _Shape } from "../entities";
import { textBlockHeight } from "../entities/shapes/text";

// worldPoint is a delta (dx, dy) in world coordinates, not an absolute point.
const baseShape = (): _Shape => ({
  id: "1",
  x: 100,
  y: 100,
  width: 200,
  height: 100,
  orderKey: "V",
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

describe("ResizeCalculator.resize on TEXT", () => {
  const textShape = (): _Shape => ({
    ...baseShape(),
    type: "TEXT",
    text: "hello",
    fontSize: 20,
  });

  it("keeps the font size when a side handle reflows the text", () => {
    const result = ResizeCalculator.resize(textShape(), ResizeHandles.Right, {
      x: 100,
      y: 0,
    });

    expect(result.width).toBe(300);
    expect(result.fontSize).toBe(20);
  });

  it("scales the font size with the box on a corner handle", () => {
    const result = ResizeCalculator.resize(
      textShape(),
      ResizeHandles.BottomRight,
      { x: 200, y: 0 },
    );

    expect(result.width).toBe(400);
    expect(result.fontSize).toBe(40);
  });

  it("moves width and height independently from a corner", () => {
    const shape = textShape();
    const result = ResizeCalculator.resize(shape, ResizeHandles.BottomRight, {
      x: 100,
      y: 300,
    });

    expect(result.width).toBe(shape.width + 100);
    expect(result.height).toBe(shape.height + 300);
  });

  it("still refuses to crop the text from a corner", () => {
    const result = ResizeCalculator.resize(
      textShape(),
      ResizeHandles.BottomRight,
      { x: 0, y: -1000 },
    );

    expect(result.height).toBe(textBlockHeight("hello", 200, 20));
  });

  it("reflows onto more lines as the block narrows", () => {
    const wide = ResizeCalculator.resize(
      { ...textShape(), text: "one two three four five six" },
      ResizeHandles.Right,
      { x: 0, y: 0 },
    );
    const narrow = ResizeCalculator.resize(
      { ...textShape(), text: "one two three four five six" },
      ResizeHandles.Right,
      { x: -120, y: 0 },
    );

    expect(narrow.width).toBeLessThan(wide.width);
    expect(narrow.height).toBeGreaterThan(wide.height);
  });

  it("grows height from a bottom handle without touching width", () => {
    const fitted = ResizeCalculator.resize(textShape(), ResizeHandles.Bottom, {
      x: 0,
      y: 0,
    });
    const result = ResizeCalculator.resize(textShape(), ResizeHandles.Bottom, {
      x: 0,
      y: 200,
    });

    expect(result.height).toBeGreaterThan(fitted.height);
    expect(result.width).toBe(textShape().width);
  });

  it("refuses to shrink height below the text", () => {
    const result = ResizeCalculator.resize(textShape(), ResizeHandles.Bottom, {
      x: 0,
      y: -1000,
    });

    expect(result.height).toBe(textBlockHeight("hello", 200, 20));
  });

  it("anchors the bottom edge when dragging the top handle", () => {
    const shape = textShape();
    const result = ResizeCalculator.resize(shape, ResizeHandles.Top, {
      x: 0,
      y: -100,
    });

    expect(result.height).toBeGreaterThan(shape.height);
    expect(result.y + result.height).toBe(shape.y + shape.height);
  });

  it("keeps hand-given slack when the block is reflowed", () => {
    const tall = { ...textShape(), height: 400 };
    const result = ResizeCalculator.resize(tall, ResizeHandles.Right, {
      x: 60,
      y: 0,
    });

    expect(result.height).toBe(400);
  });

  it("anchors the opposite edge when dragging a left handle", () => {
    const result = ResizeCalculator.resize(textShape(), ResizeHandles.Left, {
      x: 50,
      y: 0,
    });

    expect(result.width).toBe(150);
    expect(result.x + result.width).toBe(300);
  });

  it("clamps width instead of collapsing the block", () => {
    const result = ResizeCalculator.resize(textShape(), ResizeHandles.Right, {
      x: -1000,
      y: 0,
    });

    expect(result.width).toBe(40);
  });
});

describe("ResizeCalculator.getShapeManipulationBounds", () => {
  it("RECT bounds match the shape's x/y/width/height", () => {
    const bounds = ResizeCalculator.getShapeManipulationBounds(baseShape());

    expect(bounds).toEqual({ x: 100, y: 100, w: 200, h: 100 });
  });
});
