import type { CameraController } from "../camera/CameraController";

interface Point {
  x: number;
  y: number;
}

export class CoordinateTransformer {
  constructor(
    private camera: CameraController,
    private mainCanvas: HTMLCanvasElement,
    private overlayCanvas: HTMLCanvasElement,
  ) {}

  screenToWorld(screenX: number, screenY: number): Point {
    const rect = this.mainCanvas.getBoundingClientRect();
    return this.camera.screenToWorld(screenX - rect.left, screenY - rect.top);
  }

  screenToCanvas(screenX: number, screenY: number): Point {
    const rect = this.overlayCanvas.getBoundingClientRect();
    return {
      x: (screenX - rect.left) * (this.overlayCanvas.width / rect.width),
      y: (screenY - rect.top) * (this.overlayCanvas.height / rect.height),
    };
  }
}
