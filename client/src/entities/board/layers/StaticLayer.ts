import type { Shape } from "../../block";
import type { CameraState } from "./GridLayer";
import { CanvasPainter } from "../lib/CanvasPainter";

export class StaticLayer {
  shapes: Partial<Shape>[] = [
    {
      id: "1",
      x: 100,
      y: 100,
      width: 120,
      height: 80,
      fill: "#c0ff96b9",
      stroke: "#9deb55ff",
    },
    {
      id: "2",
      x: 300,
      y: 200,
      width: 300,
      height: 200,
      fill: "#ff1ba885",
      stroke: "#f8248eff",
    },
  ];

  draw(ctx: CanvasRenderingContext2D, camera: CameraState) {
    ctx.save();

    this.shapes.forEach((s) => {
      CanvasPainter.drawRectShape(ctx, s as Shape, camera);
    });

    ctx.restore();
  }
}
