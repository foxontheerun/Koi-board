import type { Shape } from "../../block";
import type { _Shape } from "../model/EntityManager";
import { adjustHexBrightness } from "./colorUtils";

export class CanvasPainter {
  public static drawRectShape(ctx: CanvasRenderingContext2D, rect: Shape) {
    const { x, y, width, height, radius = 8 } = rect;

    if (radius <= 0) {
      this.drawShapeWithFillAndStroke(
        ctx,
        rect,
        () => ctx.fillRect(x, y, width, height),
        () => ctx.strokeRect(x, y, width, height),
      );
    } else {
      const r = radius;
      this.drawShapeWithFillAndStroke(ctx, rect, () => {
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
      });
    }
  }

  public static drawEllipseShape(
    ctx: CanvasRenderingContext2D,
    ellipse: Shape,
  ) {
    const { x, y, width, height, rotation = 0 } = ellipse;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const radiusX = width / 2;
    const radiusY = height / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);
    this.drawShapeWithFillAndStroke(ctx, ellipse, () =>
      ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2),
    );
    ctx.restore();
  }

  public static drawSticker(
    ctx: CanvasRenderingContext2D,
    shape: Shape,
    options?: { shadowColor?: string; showShadow?: boolean },
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
    showShadow: boolean,
  ) {
    if (!shape) return;
    const { x, y, width, height } = shape;
    const fillColor = shape.fill || "#ccf9ffff";

    this.applyShadow(ctx, shadowColor, showShadow, 20, 0, 10);

    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, fillColor);
    gradient.addColorStop(1, adjustHexBrightness(fillColor, 15, "lighten"));

    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.fillStyle = gradient;
    ctx.fill();
    this.resetShadow(ctx);
  }

  public static drawHeart(ctx: CanvasRenderingContext2D, shape: _Shape) {
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

    const curves = [
      [x + w / 2, y + h * 0.8, x, y + (2 / 6) * h, x + w / 4, y + h / 8],
      [
        x + w / 2.8,
        y + h * 0.05,
        x + w / 1.9,
        y + h * 0.05,
        x + w / 2,
        y + h / 4,
      ],
      [
        x + w / 2.2,
        y + h * 0.05,
        (3 / 4.6) * w + x,
        y + h * 0.05,
        x + (3 / 4) * w,
        y + h / 8,
      ],
      [x + w, y + (2 / 6) * h, x + w / 2, y + h * 0.8, x + w / 2, y + h * 0.8],
    ];

    curves.forEach(([cp1x, cp1y, cp2x, cp2y, x, y]) =>
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y),
    );

    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  public static drawHandlers(
    ctx: CanvasRenderingContext2D,
    rect: Shape,
    radius: number,
    strokeWidth: number,
  ) {
    const { x, y, width, height, rotation = 0 } = rect;
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    const corners = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];

    const cos = Math.cos((rotation * Math.PI) / 180);
    const sin = Math.sin((rotation * Math.PI) / 180);

    ctx.save();
    ctx.fillStyle = "white";
    ctx.strokeStyle = "gray";
    ctx.lineWidth = strokeWidth;

    corners.forEach(([dx, dy]) => {
      const cornerX = centerX + (dx * width) / 2;
      const cornerY = centerY + (dy * height) / 2;
      const rotatedX =
        centerX + (cornerX - centerX) * cos - (cornerY - centerY) * sin;
      const rotatedY =
        centerY + (cornerX - centerX) * sin + (cornerY - centerY) * cos;
      ctx.beginPath();
      ctx.arc(rotatedX, rotatedY, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    ctx.restore();
  }

  private static drawShapeWithFillAndStroke(
    ctx: CanvasRenderingContext2D,
    shape: Shape,
    drawFill: () => void,
    drawStroke?: () => void,
  ) {
    const { fill = "blue", stroke = "", strokeWidth = 1 } = shape;
    const lineWidth = strokeWidth || 2;

    if (fill && drawFill) {
      ctx.fillStyle = fill as string;
      drawFill();
    }

    if (stroke && drawStroke) {
      ctx.strokeStyle = stroke as string;
      ctx.lineWidth = lineWidth;
      drawStroke();
    }
  }

  private static applyShadow(
    ctx: CanvasRenderingContext2D,
    color: string,
    show: boolean,
    blur = 10,
    offsetX = 0,
    offsetY = 0,
  ) {
    if (show) {
      ctx.shadowColor = color;
      ctx.shadowBlur = blur;
      ctx.shadowOffsetX = offsetX;
      ctx.shadowOffsetY = offsetY;
    } else {
      this.resetShadow(ctx);
    }
  }

  private static resetShadow(ctx: CanvasRenderingContext2D) {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
}
