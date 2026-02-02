import type { Shape } from "../../block";
import type { CameraState } from "../layers/GridLayer";

export class CanvasPainter {
  public static drawRectShape(
    ctx: CanvasRenderingContext2D,
    rect: Shape,
    camera: CameraState
  ) {
    const { fill = "blue", stroke = "", strokeWidth = 1, radius = 8 } = rect;

    const x = rect.x * camera.zoom + camera.offsetX;
    const y = rect.y * camera.zoom + camera.offsetY;

    const width = rect.width * camera.zoom;
    const height = rect.height * camera.zoom;
    const baseLineWidth = strokeWidth || 2;

    if (radius <= 0) {
      if (fill) {
        ctx.fillStyle = fill as string;
        ctx.fillRect(x, y, width, height);
      }
      ctx.strokeStyle = stroke as string;
      ctx.lineWidth = baseLineWidth;
      ctx.strokeRect(x, y, width, height);
    } else {
      const r = radius * camera.zoom;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + width - r, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + r);
      ctx.lineTo(x + width, y + height - r);
      ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
      ctx.lineTo(x + r, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();

      if (fill) {
        ctx.fillStyle = fill as string;
        ctx.fill();
      }

      ctx.strokeStyle = stroke as string;
      ctx.lineWidth = baseLineWidth;
      ctx.stroke();
    }
  }

  public static drawEllipseShape(
    ctx: CanvasRenderingContext2D,
    ellipse: Shape,
    camera: CameraState
  ) {
    const {
      fill = "blue",
      stroke = "black",
      strokeWidth = 2,
      rotation = 0,
    } = ellipse;

    const x = ellipse.x * camera.zoom + camera.offsetX;
    const y = ellipse.y * camera.zoom + camera.offsetY;
    const width = ellipse.width * camera.zoom;
    const height = ellipse.height * camera.zoom;

    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const radiusX = width / 2;
    const radiusY = height / 2;

    const lineWidth = strokeWidth || 1;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);

    ctx.beginPath();

    ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);

    if (fill) {
      ctx.fillStyle = fill as string;
      ctx.fill();
    }

    if (stroke && lineWidth > 0) {
      ctx.strokeStyle = stroke as string;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }

    ctx.closePath();
    ctx.restore();
  }
}
