import type { Shape } from "../../block";
import { CanvasPainter } from "../lib/CanvasPainter";
import { ResizeCalculator } from "../lib/ResizeCalculator";
import type { _Shape } from "../model/EntityManager";
import { RESIZE_HANDLE_SIZE } from "../model/mouseEventHandlingHelpers";

const BOUNDS_PADDING = 30;

const BORDER_COLOR = "#388effff";
const STROKE_WIDTH = 2;
export class Overlay {
  drawBounds(ctx: CanvasRenderingContext2D, shape: _Shape, zoom: number) {
    const manipulationBounds = ResizeCalculator.getShapeManipulationBounds(
      shape,
      BOUNDS_PADDING,
    );
    const borderFigure = {
      ...shape,
      fill: null,
      strokeWidth: STROKE_WIDTH,
      stroke: BORDER_COLOR,
      radius: 0,
      x: manipulationBounds.x,
      y: manipulationBounds.y,
      width: manipulationBounds.w,
      height: manipulationBounds.h,
    };

    CanvasPainter.drawRectShape(ctx, borderFigure as unknown as Shape);
    const handlerRadius = RESIZE_HANDLE_SIZE / zoom;
    const strokeWidth = 0.5 / zoom;
    CanvasPainter.drawHandlers(
      ctx,
      borderFigure as unknown as Shape,
      handlerRadius,
      strokeWidth,
    );
    ctx.restore();
  }

  drawSelectionRect(
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    currentX: number,
    currentY: number,
  ) {
    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

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
