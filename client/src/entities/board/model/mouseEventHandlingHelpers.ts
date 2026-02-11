import type { _Shape, ManipulationBounds } from "./shape.model";
import { ResizeHandles, type ResizeHandle } from "./types";

export const RESIZE_HANDLE_SIZE = 6;

export const hitTestResizeHandle = (
  bounds: ManipulationBounds,
  point: { x: number; y: number },
): ResizeHandle | null => {
  const { x, y, w, h } = bounds;
  const { x: px, y: py } = point;
  const delta = RESIZE_HANDLE_SIZE;

  const regions: [ResizeHandle, number, number, number, number][] = [
    [ResizeHandles.Top, x + delta, y - delta, w - delta * 2, delta * 2],
    [ResizeHandles.Bottom, x + delta, y + h - delta, w - delta * 2, delta * 2],
    [ResizeHandles.Left, x - delta, y + delta, delta * 2, h - delta * 2],
    [ResizeHandles.Right, x + w - delta, y + delta, delta * 2, h - delta * 2],
    [ResizeHandles.TopLeft, x - delta, y - delta, delta * 2, delta * 2],
    [ResizeHandles.TopRight, x + w - delta, y - delta, delta * 2, delta * 2],
    [ResizeHandles.BottomLeft, x - delta, y + h - delta, delta * 2, delta * 2],
    [
      ResizeHandles.BottomRight,
      x + w - delta,
      y + h - delta,
      delta * 2,
      delta * 2,
    ],
  ];

  for (const [handle, rx, ry, rw, rh] of regions) {
    if (px >= rx && px <= rx + rw && py >= ry && py <= ry + rh) return handle;
  }

  return null;
};
