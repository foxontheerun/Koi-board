import type { Shape } from "../../../entities/Shape";
import type { _Shape } from "../../entities";
import { CanvasPainter } from "../../utils";

export class DragLayer {
  draw(ctx: CanvasRenderingContext2D, shapes: _Shape[]) {
    shapes.forEach((s) => {
      // const s = { ...shape, fill: "#FF000033" };
      switch (s.type) {
        case "STICKER":
          CanvasPainter.drawSticker(ctx, s as unknown as Shape);
          break;
        case "ELLIPSE":
          CanvasPainter.drawEllipseShape(ctx, s as unknown as Shape);
          break;
        case "RECT":
          CanvasPainter.drawRectShape(ctx, s as unknown as Shape);
          break;
        default:
          CanvasPainter.drawRectShape(ctx, s as unknown as Shape);
          break;
      }
    });
  }
}
