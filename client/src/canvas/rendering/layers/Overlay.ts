import type { Shape } from "../../../entities/Shape";
import type { _Shape } from "../../entities";
import { ResizeCalculator } from "../../interaction";
import { CanvasPainter } from "../../utils";
import { RESIZE_HANDLE_SIZE } from "./mouseEventHandlingHelpers";

const BORDER_COLOR = "#16B8D4";
const LOCKED_BORDER_COLOR = "#9ca3af";
const STROKE_WIDTH = 2;
export class Overlay {
  drawBounds(
    ctx: CanvasRenderingContext2D,
    shape: _Shape,
    zoom: number,
    showHandles = true,
  ) {
    const manipulationBounds =
      ResizeCalculator.getShapeManipulationBounds(shape);
    const locked = shape.locked === true;
    // Use the raw bounds (no rounding): the ctx is already camera-transformed,
    // so rounding here would snap in world units and misalign with the shape.
    const borderFigure = {
      ...shape,
      fill: null,
      strokeWidth: STROKE_WIDTH,
      stroke: locked ? LOCKED_BORDER_COLOR : BORDER_COLOR,
      radius: 0,
      x: manipulationBounds.x,
      y: manipulationBounds.y,
      width: manipulationBounds.w,
      height: manipulationBounds.h,
    };

    CanvasPainter.drawRectShape(ctx, borderFigure as unknown as Shape);

    // No handles on a locked shape, nor while it is being dragged (Miro shows
    // just the outline during a move).
    if (
      locked ||
      !showHandles ||
      shape.state === "dragging" ||
      shape.state === "remote-dragging"
    ) {
      return;
    }

    const handlerRadius = Math.ceil(RESIZE_HANDLE_SIZE / zoom);
    const strokeWidth = Math.ceil(0.5 / zoom);
    CanvasPainter.drawHandlers(
      ctx,
      borderFigure as unknown as Shape,
      handlerRadius,
      strokeWidth,
    );
  }

  drawGroupBounds(
    ctx: CanvasRenderingContext2D,
    shapes: _Shape[],
    zoom: number,
  ) {
    const bounds = groupManipulationBounds(shapes);
    const borderFigure = {
      fill: null,
      strokeWidth: STROKE_WIDTH,
      stroke: BORDER_COLOR,
      radius: 0,
      x: bounds.x,
      y: bounds.y,
      width: bounds.w,
      height: bounds.h,
    };

    CanvasPainter.drawRectShape(ctx, borderFigure as unknown as Shape);

    const handlerRadius = Math.ceil(RESIZE_HANDLE_SIZE / zoom);
    const strokeWidth = Math.ceil(0.5 / zoom);
    CanvasPainter.drawHandlers(
      ctx,
      borderFigure as unknown as Shape,
      handlerRadius,
      strokeWidth,
    );
  }

  drawSelectionRect(
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    currentX: number,
    currentY: number,
  ) {
    const x = Math.ceil(Math.min(startX, currentX));
    const y = Math.ceil(Math.min(startY, currentY));
    const width = Math.ceil(Math.abs(currentX - startX));
    const height = Math.ceil(Math.abs(currentY - startY));

    const selectionShape = {
      x,
      y,
      width,
      height,
      fill: "rgba(0, 120, 215, 0.2)",
      stroke: "rgba(0, 120, 215, 0.8)",
      strokeWidth: 1,
      radius: 0,
    };

    CanvasPainter.drawRectShape(ctx, selectionShape as Shape);
  }
}

export function groupManipulationBounds(shapes: _Shape[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const shape of shapes) {
    const b = ResizeCalculator.getShapeManipulationBounds(shape);
    minX = Math.min(minX, b.x, b.x + b.w);
    minY = Math.min(minY, b.y, b.y + b.h);
    maxX = Math.max(maxX, b.x, b.x + b.w);
    maxY = Math.max(maxY, b.y, b.y + b.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
