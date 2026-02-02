import type { Shape } from "../../block";
import { CanvasPainter } from "../lib/CanvasPainter";
import type { _Shape } from "../model/EntityManager";
import type { CameraState } from "./GridLayer";

export class DragLayer {
  draw(ctx: CanvasRenderingContext2D, camera: CameraState, shapes: _Shape[]) {
    ctx.save();

    shapes.forEach((s) => {
      if (s.state != "dragging") return;
      switch (s.type) {
        case "ELLIPSE":
          CanvasPainter.drawEllipseShape(ctx, s as unknown as Shape, camera);
          break;
        case "RECT":
        default:
          CanvasPainter.drawRectShape(ctx, s as unknown as Shape, camera);
      }
    });

    ctx.restore();
  }
}
