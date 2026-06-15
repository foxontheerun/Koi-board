import type { Shape } from "../../entities/Shape";
import type { _Shape } from "../entities";
import { adjustHexBrightness } from "./colorUtils";

export class CanvasPainter {
  public static drawRectShape(ctx: CanvasRenderingContext2D, shape: Shape) {
    const { fill, stroke, strokeWidth } = shape;

    // ✅ Нормализуем фигуру (обрабатываем отрицательные width/height)
    const normalized = this.normalizeShape(shape);
    const { x, y, width, height, radius = 8 } = normalized;

    // ✅ Безопасный радиус (не больше половины меньшей стороны)
    const safeRadius = Math.max(
      0,
      Math.min(radius, Math.ceil(width / 2), Math.ceil(height / 2)),
    );

    ctx.save();

    // Рисуем путь
    ctx.beginPath();

    if (safeRadius > 0) {
      ctx.moveTo(x + safeRadius, y);
      ctx.lineTo(x + width - safeRadius, y);
      ctx.arcTo(x + width, y, x + width, y + safeRadius, safeRadius);
      ctx.lineTo(x + width, y + height - safeRadius);
      ctx.arcTo(
        x + width,
        y + height,
        x + width - safeRadius,
        y + height,
        safeRadius,
      );
      ctx.lineTo(x + safeRadius, y + height);
      ctx.arcTo(x, y + height, x, y + height - safeRadius, safeRadius);
      ctx.lineTo(x, y + safeRadius);
      ctx.arcTo(x, y, x + safeRadius, y, safeRadius);
      ctx.closePath();
    } else {
      ctx.rect(x, y, width, height);
    }

    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }

    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeWidth ?? 2;
      ctx.stroke();
    }

    ctx.restore();
  }

  private static normalizeShape(shape: Shape): Shape {
    let { x, y, width, height } = shape;

    if (width < 0) {
      x = x + width;
      width = Math.abs(width);
    }

    if (height < 0) {
      y = y + height;
      height = Math.abs(height);
    }

    return {
      ...shape,
      x,
      y,
      width,
      height,
    };
  }

  public static drawEllipseShape(
    ctx: CanvasRenderingContext2D,
    ellipse: Shape,
  ) {
    const {
      x,
      y,
      width,
      height,
      rotation = 0,
      fill,
      stroke,
      strokeWidth,
    } = ellipse;
    const centerX = Math.ceil(x + width / 2);
    const centerY = Math.ceil(y + height / 2);
    const radiusX = Math.ceil(Math.abs(width / 2));
    const radiusY = Math.ceil(Math.abs(height / 2));

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);

    ctx.beginPath();
    ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);

    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }

    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeWidth ?? 2;
      ctx.stroke();
    }

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
    if (shape.text) {
      ctx.fillStyle = "#333";
      ctx.font = "14px sans-serif";
      ctx.fillText(shape.text, shape.x + 8, shape.y + 20);
    }
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

    this.applyShadow(ctx, shadowColor, showShadow, 8, 0, 4);

    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, adjustHexBrightness(fillColor, 3, "lighten"));
    gradient.addColorStop(1, adjustHexBrightness(fillColor, 10, "darken"));

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
    ctx.moveTo(x + Math.ceil(w / 2), y + Math.ceil(h * 0.8));

    const curves = [
      [
        x + Math.ceil(w / 2),
        y + Math.ceil(h * 0.8),
        x,
        y + Math.ceil((2 / 6) * h),
        Math.ceil(x + w / 4),
        Math.ceil(y + h / 8),
      ],
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
