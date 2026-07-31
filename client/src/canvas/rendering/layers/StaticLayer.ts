import type { Shape } from "../../../entities/Shape";
import type { _Shape } from "../../entities";
import { CanvasPainter } from "../../utils";

export class StaticLayer {
  draw(
    ctx: CanvasRenderingContext2D,
    shapes: _Shape[],
    editingShapeId?: string | null,
  ) {
    shapes.forEach((s) => {
      if (
        s.state === "dragging" ||
        s.state === "remote-dragging" ||
        s.state === "resizing"
      )
        return;

      const isEditing = s.id === editingShapeId;

      switch (s.type) {
        case "STICKER":
          CanvasPainter.drawSticker(ctx, s as unknown as Shape, {
            showText: !isEditing,
          });
          break;
        case "ELLIPSE":
          CanvasPainter.drawEllipseShape(ctx, s as unknown as Shape);
          break;
        case "RECT":
          CanvasPainter.drawRectShape(ctx, s as unknown as Shape);
          break;
        case "TEXT":
          if (!isEditing) CanvasPainter.drawText(ctx, s as unknown as Shape);
          break;
        default:
          CanvasPainter.drawSticker(ctx, s as unknown as Shape);
      }
    });

    ctx.restore();
  }
}
