import type { Shape } from "../../../entities/Shape";
import type { _Shape } from "../../entities";
import { CanvasPainter } from "../../utils";

export class StaticLayer {
  draw(ctx: CanvasRenderingContext2D, shapes: _Shape[]) {
    shapes.forEach((s) => {
      if (s.state != "static") return;
      switch (s.type) {
        case "ELLIPSE":
          CanvasPainter.drawEllipseShape(ctx, s as unknown as Shape);
          break;
        case "RECT":
          CanvasPainter.drawRectShape(ctx, s as unknown as Shape);
          break;
        default:
          CanvasPainter.drawSticker(ctx, s as unknown as Shape);
      }
    });

    ctx.restore();
  }
}
