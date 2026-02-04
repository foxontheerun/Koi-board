import type { Shape } from "../../block";
import type { _Shape } from "../model/EntityManager";
import { adjustHexBrightness } from "./colorUtils";

export class CanvasPainter {
  public static drawRectShape(ctx: CanvasRenderingContext2D, rect: Shape) {
    const { fill = "blue", stroke = "", strokeWidth = 1, radius = 8 } = rect;

    const x = rect.x;
    const y = rect.y;

    const width = rect.width;
    const height = rect.height;
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
      const r = radius;
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
    ellipse: Shape
  ) {
    const {
      fill = "blue",
      stroke = "black",
      strokeWidth = 2,
      rotation = 0,
    } = ellipse;

    const x = ellipse.x;
    const y = ellipse.y;
    const width = ellipse.width;
    const height = ellipse.height;

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

  public static drawSticker(
    ctx: CanvasRenderingContext2D,
    shape: Shape,
    options?: {
      shadowColor?: string;
      shadowOpacity?: number;
      showShadow?: boolean;
    }
  ) {
    const { shadowColor = "rgba(90, 112, 145, 0.36)", showShadow = true } =
      options || {};

    ctx.save();

    this.drawStickerWithShadow(ctx, shape, shadowColor, showShadow);

    ctx.restore();
  }

  static drawStickerWithShadow(
    ctx: CanvasRenderingContext2D,
    shape: Shape,
    shadowColor: string,
    showShadow: boolean
  ) {
    if (!shape) return;

    const { x, y, width, height } = shape;
    const fillColor = shape.fill || "#ccf9ffff";

    ctx.save();

    if (showShadow) {
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 10;
    } else {
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    const gradient = ctx.createLinearGradient(x, y, x, y + height);

    gradient.addColorStop(0, fillColor);
    gradient.addColorStop(1, adjustHexBrightness(fillColor, 15, "lighten"));

    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.save();

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.restore();
  }

  static drawHeart(ctx: CanvasRenderingContext2D, shape: _Shape) {
    const { x, y, width: w, height: h, fill, stroke, strokeWidth } = shape;

    ctx.save();

    const gradient = ctx.createLinearGradient(x, y, x, y + h);

    gradient.addColorStop(0, adjustHexBrightness(fill, 5, "darken"));
    gradient.addColorStop(1, adjustHexBrightness(fill, 15, "lighten"));

    ctx.fillStyle = gradient;

    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth ? parseFloat(strokeWidth) : 2;

    ctx.beginPath();

    ctx.moveTo(x + w / 2, y + h * 0.8);

    ctx.bezierCurveTo(
      x + w / 2,
      y + h * 0.8,
      x,
      y + (2 / 6) * h,
      x + w / 4,
      y + h / 8
    );

    ctx.bezierCurveTo(
      x + w / 2.8,
      y + h * 0.05,
      x + w / 1.9,
      y + h * 0.05,
      x + w / 2,
      y + h / 4
    );

    ctx.bezierCurveTo(
      x + w / 2.2,
      y + h * 0.05,
      x + (3 / 4.6) * w,
      y + h * 0.05,
      x + (3 / 4) * w,
      y + h / 8
    );

    ctx.bezierCurveTo(
      x + w,
      y + (2 / 6) * h,
      x + w / 2,
      y + h * 0.8,
      x + w / 2,
      y + h * 0.8
    );

    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}
