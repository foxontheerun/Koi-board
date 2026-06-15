import type { CameraController } from "../camera/CameraController";
import type { _Shape } from "../entities";
import { RESIZE_HANDLE_SIZE } from "../rendering/layers/mouseEventHandlingHelpers";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Covers: overlay bounds padding (30 world units → screen) + handle radius + stroke overhang.
function computePadding(zoom: number): number {
  return 30 * zoom + RESIZE_HANDLE_SIZE + 4;
}

export function computeShapesBoundingRect(
  camera: CameraController,
  shapes: _Shape[],
): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const s of shapes) {
    const corners = [
      camera.worldToScreen(s.x, s.y),
      camera.worldToScreen(s.x + s.width, s.y),
      camera.worldToScreen(s.x, s.y + s.height),
      camera.worldToScreen(s.x + s.width, s.y + s.height),
    ];

    for (const c of corners) {
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.x > maxX) maxX = c.x;
      if (c.y > maxY) maxY = c.y;
    }
  }

  const padding = computePadding(camera.getScale());

  return {
    x: Math.ceil(minX - padding),
    y: Math.ceil(minY - padding),
    w: Math.ceil(maxX - minX + padding * 2),
    h: Math.ceil(maxY - minY + padding * 2),
  };
}

// Always resets transform to identity before clearing — clearRect operates in screen space.
export function clearDirtyRect(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  rect: Rect | null,
) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (rect) {
    ctx.clearRect(rect.x, rect.y, rect.w, rect.h);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

export function unionRects(a: Rect, b: Rect): Rect {
  const x = Math.ceil(Math.min(a.x, b.x));
  const y = Math.ceil(Math.min(a.y, b.y));
  const maxX = Math.ceil(Math.max(a.x + a.w, b.x + b.w));
  const maxY = Math.ceil(Math.max(a.y + a.h, b.y + b.h));
  return { x, y, w: maxX - x, h: maxY - y };
}

// Selection box is already in screen space — only padding is added.
export function selectionBoxToRect(selectionBox: {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}): Rect {
  const SELECTION_PADDING = 4;
  const x = Math.ceil(Math.min(selectionBox.startX, selectionBox.currentX));
  const y = Math.ceil(Math.min(selectionBox.startY, selectionBox.currentY));
  const w = Math.ceil(Math.abs(selectionBox.currentX - selectionBox.startX));
  const h = Math.ceil(Math.abs(selectionBox.currentY - selectionBox.startY));
  return {
    x: x - SELECTION_PADDING,
    y: y - SELECTION_PADDING,
    w: w + SELECTION_PADDING * 2,
    h: h + SELECTION_PADDING * 2,
  };
}
