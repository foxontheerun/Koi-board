import { describe, it, expect } from "vitest";
import {
  computeShapesBoundingRect,
  rectsIntersect,
  selectionBoxToRect,
  unionRects,
} from "./dirtyRect";
import type { CameraController } from "../camera/CameraController";
import type { _Shape } from "../entities";

describe("rectsIntersect", () => {
  const base = { x: 0, y: 0, w: 100, h: 100 };

  it("is true when rects overlap", () => {
    expect(rectsIntersect(base, { x: 50, y: 50, w: 100, h: 100 })).toBe(true);
  });

  it("is true when one contains the other", () => {
    expect(rectsIntersect(base, { x: 20, y: 20, w: 10, h: 10 })).toBe(true);
  });

  it("is false when rects are apart on either axis", () => {
    expect(rectsIntersect(base, { x: 200, y: 0, w: 10, h: 10 })).toBe(false);
    expect(rectsIntersect(base, { x: 0, y: 200, w: 10, h: 10 })).toBe(false);
  });

  it("is false when rects only share an edge", () => {
    expect(rectsIntersect(base, { x: 100, y: 0, w: 10, h: 100 })).toBe(false);
  });

  it("is symmetric", () => {
    const other = { x: 90, y: 90, w: 50, h: 50 };
    expect(rectsIntersect(base, other)).toBe(rectsIntersect(other, base));
  });
});

describe("unionRects", () => {
  it("covers two disjoint rectangles", () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    const b = { x: 20, y: 20, w: 10, h: 10 };
    expect(unionRects(a, b)).toEqual({ x: 0, y: 0, w: 30, h: 30 });
  });

  it("leaves the outer rect unchanged when one contains the other", () => {
    const big = { x: 0, y: 0, w: 100, h: 100 };
    const small = { x: 20, y: 20, w: 10, h: 10 };

    expect(unionRects(big, small)).toEqual(big);
  });

  it("is commutative: union(a, b) === union(b, a)", () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    const b = { x: 50, y: 50, w: 10, h: 10 };

    expect(unionRects(a, b)).toEqual(unionRects(b, a));
  });
});

describe("selectionBoxToRect", () => {
  it("adds 4px padding when dragging right and down", () => {
    const rect = selectionBoxToRect({
      startX: 10,
      startY: 10,
      currentX: 110,
      currentY: 60,
    });
    expect(rect).toEqual({ x: 6, y: 6, w: 108, h: 58 });
  });

  it("gives the same rect when dragging in the opposite direction", () => {
    const forward = selectionBoxToRect({
      startX: 10,
      startY: 10,
      currentX: 110,
      currentY: 60,
    });
    const backward = selectionBoxToRect({
      startX: 110,
      startY: 60,
      currentX: 10,
      currentY: 10,
    });

    expect(backward).toEqual(forward);
  });

  it("collapses to padding only when start === current (w = h = 8)", () => {
    const rect = selectionBoxToRect({
      startX: 50,
      startY: 50,
      currentX: 50,
      currentY: 50,
    });

    expect(rect).toEqual({ x: 46, y: 46, w: 8, h: 8 });
  });
});

// Fake 1:1 camera so screen coords == world coords; the real CameraController
// needs DOMMatrix, which the node test environment doesn't have.
// At scale 1, padding = 30 * 1 + RESIZE_HANDLE_SIZE(6) + 4 + SHADOW_PADDING(16) = 56.
const fakeCamera = {
  worldToScreen: (x: number, y: number) => ({ x, y }),
  getScale: () => 1,
} as unknown as CameraController;

const shape = (x: number, y: number, width: number, height: number) =>
  ({ x, y, width, height }) as unknown as _Shape;

describe("computeShapesBoundingRect", () => {
  it("covers a single shape plus padding", () => {
    // shape spans 100,100 → 300,150; +56 padding on every side
    const rect = computeShapesBoundingRect(fakeCamera, [
      shape(100, 100, 200, 50),
    ]);

    expect(rect).toEqual({ x: 44, y: 44, w: 312, h: 162 });
  });

  it("covers the extreme corners of multiple shapes", () => {
    const rect = computeShapesBoundingRect(fakeCamera, [
      shape(0, 0, 50, 50),
      shape(200, 100, 100, 100),
    ]);

    expect(rect).toEqual({ x: -56, y: -56, w: 412, h: 312 });
  });
});
