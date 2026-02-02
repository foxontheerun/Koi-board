import { CameraController } from "./CameraController";
import { GridLayer } from "../layers/GridLayer";
import { StaticLayer } from "../layers/StaticLayer";
import { DragLayer } from "../layers/DragLayer";
import { EntityManager, type _Shape } from "../model/EntityManager";
import { Overlay } from "../layers/Overlay";
import { ImagePainter } from "./ImagePainter";

export class BoardRuntime {
  camera = new CameraController();
  private dragCtx: CanvasRenderingContext2D;
  private gridCtx: CanvasRenderingContext2D;
  private mainCtx: CanvasRenderingContext2D;
  private overlayCtx: CanvasRenderingContext2D;

  private gridCanvas: HTMLCanvasElement;
  private mainCanvas: HTMLCanvasElement;
  private dragCanvas: HTMLCanvasElement;
  private overlayCanvas: HTMLCanvasElement;

  gridLayer = new GridLayer();
  staticLayer = new StaticLayer();
  dragLayer = new DragLayer();
  overlay = new Overlay();

  entityManager = new EntityManager();

  private draggedShape: _Shape | null = null;
  private dragStartOffset = { x: 0, y: 0 };

  constructor(
    gridCanvas: HTMLCanvasElement,
    mainCanvas: HTMLCanvasElement,
    drag: HTMLCanvasElement,
    overlay: HTMLCanvasElement
  ) {
    this.gridCanvas = gridCanvas;
    this.mainCanvas = mainCanvas;
    this.dragCanvas = drag;
    this.overlayCanvas = overlay;

    this.gridCtx = gridCanvas.getContext("2d")!;
    this.mainCtx = mainCanvas.getContext("2d")!;
    this.dragCtx = drag.getContext("2d")!;
    this.overlayCtx = overlay.getContext("2d")!;

    this.updateSize();

    this.camera.subscribe(() => {
      this.drawAll();
    });

    this.drawAll();
  }

  updateSize() {
    const rect = this.mainCanvas.getBoundingClientRect();

    [
      this.gridCanvas,
      this.mainCanvas,
      this.dragCanvas,
      this.overlayCanvas,
    ].forEach((canvas) => {
      canvas.width = rect.width;
      canvas.height = rect.height;
    });

    this.camera.updateViewport(this.mainCanvas);
    this.drawAll();
  }

  drawAll() {
    this.drawGrid();
    this.drawStatic();
    this.drawDrag();
    this.drawOverlay();
    this.drawImageWithCamera();
  }

  drawGrid() {
    this.gridCtx.clearRect(0, 0, this.gridCanvas.width, this.gridCanvas.height);
    this.gridLayer.draw(this.gridCtx, this.camera.state);
  }

  drawStatic() {
    this.mainCtx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);

    this.staticLayer.draw(
      this.mainCtx,
      this.camera.state,
      this.entityManager.getShapes()
    );
    this.drawImageWithCamera();
  }

  drawDrag() {
    this.dragCtx.clearRect(0, 0, this.dragCanvas.width, this.dragCanvas.height);

    this.dragLayer.draw(
      this.dragCtx,
      this.camera.state,
      this.entityManager.getShapes()
    );
  }

  drawOverlay() {
    this.overlayCtx.clearRect(
      0,
      0,
      this.overlayCanvas.width,
      this.overlayCanvas.height
    );

    if (!this.draggedShape) return;
    this.overlay.drawBorder(this.overlayCtx, this.camera, this.draggedShape);
  }

  handleMouseDown(screenX: number, screenY: number) {
    const rect = this.mainCanvas.getBoundingClientRect();
    const localX = screenX - rect.left;
    const localY = screenY - rect.top;

    const worldPoint = this.camera.screenToWorld(localX, localY);

    const shape = this.entityManager.findShapeAt(worldPoint);

    if (shape) {
      this.draggedShape = shape;

      shape.state = "dragging";

      this.dragStartOffset = {
        x: worldPoint.x - shape.x,
        y: worldPoint.y - shape.y,
      };

      this.drawStatic();
      this.drawDrag();
      this.drawOverlay();
    }
  }

  handleMouseMove(screenX: number, screenY: number) {
    if (!this.draggedShape) return;

    const rect = this.mainCanvas.getBoundingClientRect();
    const worldPoint = this.camera.screenToWorld(
      screenX - rect.left,
      screenY - rect.top
    );

    this.draggedShape.x = worldPoint.x - this.dragStartOffset.x;
    this.draggedShape.y = worldPoint.y - this.dragStartOffset.y;

    this.drawDrag();
    this.drawOverlay();
  }

  handleMouseUp() {
    if (this.draggedShape) {
      this.draggedShape.state = "static";
      this.draggedShape = null;
      this.drawAll();
      this.drawOverlay();
    }
  }

  dispose() {}

  // test
  async drawImageWithCamera() {
    await ImagePainter.drawImage(
      this.mainCtx,
      "joker.jpg",
      400,
      400,
      150,
      150,
      this.camera.state
    );
  }
}
