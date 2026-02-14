import type { CameraState } from "../lib/CameraController";
import {
  BASE_GRID_COLOR,
  buildGridLayers,
  type GridLayerConfig,
} from "./models/buildGridLayers";

export class GridLayer {
  draw(ctx: CanvasRenderingContext2D, camera: CameraState) {
    const layers = buildGridLayers(camera.zoom);

    ctx.save();
    ctx.lineCap = "butt";
    ctx.strokeStyle = `rgb(${BASE_GRID_COLOR})`;

    layers.forEach((layer) => {
      this.drawLayer(ctx, camera, layer);
    });

    ctx.restore();
  }

  private drawLayer(
    ctx: CanvasRenderingContext2D,
    camera: CameraState,
    layer: GridLayerConfig,
  ) {
    const { size, opacity, lineWidth } = layer;

    ctx.globalAlpha = opacity;
    ctx.lineWidth = lineWidth;

    const width = camera.viewportWidth;
    const height = camera.viewportHeight;

    // Вычисляем остаток: где относительно левого/верхнего края
    // должна пройти первая линия "от нуля"
    // Используем положительный остаток, чтобы сетка не прыгала
    let startX = camera.offsetX % size;
    let startY = camera.offsetY % size;

    // Сдвигаем назад, чтобы сетка всегда начиналась за пределами экрана слева/сверху
    if (startX > 0) startX -= size;
    if (startY > 0) startY -= size;

    ctx.beginPath();

    for (let x = startX; x < width; x += size) {
      const roundX = Math.round(x) + 0.5;
      ctx.moveTo(roundX, 0);
      ctx.lineTo(roundX, height);
    }

    for (let y = startY; y < height; y += size) {
      const roundY = Math.round(y) + 0.5;
      ctx.moveTo(0, roundY);
      ctx.lineTo(width, roundY);
    }

    ctx.stroke();
  }
}
