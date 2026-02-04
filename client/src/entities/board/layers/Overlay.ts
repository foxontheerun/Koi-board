import type { Shape } from "../../block";
import { CanvasPainter } from "../lib/CanvasPainter";
import { ResizeCalculator } from "../lib/ResizeCalculator";
import type { _Shape } from "../model/EntityManager";

const BOUNDS_PADDING = 30;

const BORDER_COLOR = "#388effff";
const STROKE_WIDTH = 3;
export class Overlay {
  drawBounds(ctx: CanvasRenderingContext2D, shape: _Shape) {
    const manipulationBounds = ResizeCalculator.getShapeManipulationBounds(
      shape,
      BOUNDS_PADDING
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

    ctx.restore();
  }
}
