import {
  BASE_GRID_COLOR,
  buildGridLayers,
  type GridLayerConfig,
} from "./models/buildGridLayers";

export type CameraState = {
  zoom: number;
  offsetX: number;
  offsetY: number;
  viewportWidth: number;
  viewportHeight: number;
};

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
    layer: GridLayerConfig
  ) {
    // console.log("drawLayer", layer);

    const { size, opacity, lineWidth } = layer;

    ctx.globalAlpha = opacity;
    ctx.lineWidth = lineWidth;

    const width = camera.viewportWidth;
    const height = camera.viewportHeight;

    // 1. Вычисляем остаток: где относительно левого/верхнего края
    // должна пройти первая линия "от нуля"
    // Используем положительный остаток, чтобы сетка не прыгала
    let startX = camera.offsetX % size;
    let startY = camera.offsetY % size;

    // Сдвигаем назад, чтобы сетка всегда начиналась за пределами экрана слева/сверху
    if (startX > 0) startX -= size;
    if (startY > 0) startY -= size;

    // 2. БАТЧИНГ: Рисуем всю сетку за один проход "пером"
    ctx.beginPath();

    // Вертикальные линии
    for (let x = startX; x < width; x += size) {
      // 0.5 — хак для четкости 1px линий (чтобы не попадать между пикселями)
      const roundX = Math.round(x) + 0.5;
      ctx.moveTo(roundX, 0);
      ctx.lineTo(roundX, height);
    }

    // Горизонтальные линии
    for (let y = startY; y < height; y += size) {
      const roundY = Math.round(y) + 0.5;
      ctx.moveTo(0, roundY);
      ctx.lineTo(width, roundY);
    }

    // 3. Один раз отрисовываем всё накопленное
    ctx.stroke();
  }
}
