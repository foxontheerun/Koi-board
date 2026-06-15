import type { Shape } from "../../../entities/Shape";
import type { _Shape } from "../../entities";
import { ResizeCalculator } from "../../interaction";
import { CanvasPainter } from "../../utils";
import { RESIZE_HANDLE_SIZE } from "./mouseEventHandlingHelpers";

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
      x: Math.ceil(manipulationBounds.x),
      y: Math.ceil(manipulationBounds.y),
      width: Math.ceil(manipulationBounds.w),
      height: Math.ceil(manipulationBounds.h),
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
