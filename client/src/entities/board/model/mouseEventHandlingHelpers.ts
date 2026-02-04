import type { _Shape } from "./shape.model";
import { ResizeHandles, type ResizeHandle } from "./types";

export const hitTestResizeHandle = (
  shape: _Shape,
  point: {
    x: number;
    y: number;
  }
): ResizeHandle | null => {
  const delta = 15;
  const px = point.x;
  const py = point.y;
  const w = shape.width;
  const h = shape.height;
  const x = shape.x;
  const y = shape.y;

  const inRect = (x: number, y: number, w: number, h: number): boolean => {
    return px >= x && px <= x + w && py >= y && py <= y + h;
  };

  if (inRect(x + delta, y - delta, w - delta * 2, delta * 2))
    return ResizeHandles.Top;
  if (inRect(x + delta, y + h - delta, w - delta * 2, delta * 2))
    return ResizeHandles.Bottom;

  if (inRect(x - delta, y - delta, delta * 2, h - 2 * delta))
    return ResizeHandles.Left;
  if (inRect(x - delta + w, y + delta, delta * 2, h - 2 * delta))
    return ResizeHandles.Right;

  if (inRect(x - delta, y - delta, delta * 2, delta * 2))
    return ResizeHandles.TopLeft;
  if (inRect(x + w - delta, y - delta, delta * 2, delta * 2))
    return ResizeHandles.TopRight;

  if (inRect(x - delta, y + h - delta, delta * 2, delta * 2))
    return ResizeHandles.BottomLeft;
  if (inRect(x + w - delta, y + h - delta, delta * 2, delta * 2))
    return ResizeHandles.BottomRight;
  return null;
};
