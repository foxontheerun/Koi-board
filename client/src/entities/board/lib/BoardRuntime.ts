import { CameraController } from "./CameraController";
import { GridLayer } from "../layers/GridLayer";
import { StaticLayer } from "../layers/StaticLayer";

export class BoardRuntime {
  camera = new CameraController();

  private gridCtx: CanvasRenderingContext2D;
  private mainCtx: CanvasRenderingContext2D;
  private gridCanvas: HTMLCanvasElement;
  private mainCanvas: HTMLCanvasElement;

  gridLayer = new GridLayer();
  staticLayer = new StaticLayer();

  constructor(gridCanvas: HTMLCanvasElement, mainCanvas: HTMLCanvasElement) {
    this.gridCanvas = gridCanvas;
    this.mainCanvas = mainCanvas;
    this.gridCtx = gridCanvas.getContext("2d")!;
    this.mainCtx = mainCanvas.getContext("2d")!;

    this.updateSize();

    this.camera.subscribe(() => {
      this.draw();
    });

    this.draw();
  }

  updateSize() {
    const rect = this.mainCanvas.getBoundingClientRect();

    [this.gridCanvas, this.mainCanvas].forEach((canvas) => {
      canvas.width = rect.width;
      canvas.height = rect.height;
    });

    this.camera.updateViewport(this.mainCanvas);
    this.draw();
  }

  draw() {
    const cameraState = this.camera.state;

    this.gridCtx.clearRect(0, 0, this.gridCanvas.width, this.gridCanvas.height);
    this.gridLayer.draw(this.gridCtx, cameraState);

    this.mainCtx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
    this.staticLayer.draw(this.mainCtx, cameraState);
  }

  dispose() {}
}
