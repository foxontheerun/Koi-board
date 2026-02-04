import { CameraController } from "./CameraController";
import { GridLayer } from "../layers/GridLayer";
import { StaticLayer } from "../layers/StaticLayer";
import { DragLayer } from "../layers/DragLayer";
import { EntityManager, type _Shape } from "../model/EntityManager";
import { Overlay } from "../layers/Overlay";
import {
  ResizeHandles,
  type InteractionMode,
  type ResizeHandle,
} from "../model/types";
import { hitTestResizeHandle } from "../model/mouseEventHandlingHelpers";
import { ResizeCalculator } from "./ResizeCalculator";

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

  private focusedShape: _Shape | null = null;
  private interaction: InteractionMode = { type: "idle" };

  private dragStartOffset = { x: 0, y: 0 };

  private rafId: number | null = null;

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

  requestDraw() {
    if (this.rafId !== null) return;

    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;

      this.requestDraw();
    });
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
  }

  drawGrid() {
    this.gridCtx.clearRect(0, 0, this.gridCanvas.width, this.gridCanvas.height);
    this.gridLayer.draw(this.gridCtx, this.camera.state);
  }

  drawStatic() {
    this.mainCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.mainCtx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);

    this.mainCtx.save();
    this.camera.applyTransform(this.mainCtx);

    this.staticLayer.draw(this.mainCtx, this.entityManager.getShapes());

    this.mainCtx.restore();
  }

  drawDrag() {
    this.dragCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.dragCtx.clearRect(0, 0, this.dragCanvas.width, this.dragCanvas.height);

    this.dragCtx.save();
    this.camera.applyTransform(this.dragCtx);

    this.dragLayer.draw(this.dragCtx, this.entityManager.getShapes());

    this.dragCtx.restore();
  }

  drawOverlay() {
    this.overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.overlayCtx.clearRect(
      0,
      0,
      this.overlayCanvas.width,
      this.overlayCanvas.height
    );

    if (!this.focusedShape) return;

    this.overlayCtx.save();
    this.camera.applyTransform(this.overlayCtx);

    this.overlay.drawBorder(this.overlayCtx, this.focusedShape);

    this.overlayCtx.restore();
  }

  handleMouseDown(screenX: number, screenY: number) {
    const rect = this.mainCanvas.getBoundingClientRect();
    const localX = screenX - rect.left;
    const localY = screenY - rect.top;

    const worldPoint = this.camera.screenToWorld(localX, localY);

    const shape = this.entityManager.findShapeAt(worldPoint);

    if (!shape) return;
    this.interaction = { type: "drag", shape };

    const handle = hitTestResizeHandle(shape, worldPoint);

    console.log("handle", handle);

    if (handle) {
      this.interaction = { type: "resize", shape, handle };
    }

    this.focusedShape = shape;

    // убрать мутацию!
    shape.state = "dragging";

    this.dragStartOffset = {
      x: worldPoint.x - shape.x,
      y: worldPoint.y - shape.y,
    };

    this.drawStatic();
    this.drawDrag();
    this.drawOverlay();
  }

  handleMouseMove(screenX: number, screenY: number) {
    if (!this.focusedShape) return;

    const rect = this.mainCanvas.getBoundingClientRect();
    const worldPoint = this.camera.screenToWorld(
      screenX - rect.left,
      screenY - rect.top
    );
    if (this.interaction.type === "drag") {
      this.applyDrag(worldPoint);
    } else if (this.interaction.type === "resize") {
      this.applyResize(this.interaction.handle, worldPoint);
    }

    this.drawDrag();
    this.drawOverlay();
  }

  applyDrag(worldPoint: { x: number; y: number }) {
    if (!this.focusedShape) return;
    this.focusedShape.x = worldPoint.x - this.dragStartOffset.x;
    this.focusedShape.y = worldPoint.y - this.dragStartOffset.y;
  }

  applyResize(handle: ResizeHandle, worldPoint: { x: number; y: number }) {
    if (!this.focusedShape) return;

    const shape = ResizeCalculator.resize(
      this.focusedShape,
      handle,
      worldPoint
    );
    this.focusedShape = shape;
    this.entityManager.updateShapeList(shape);
  }

  handleMouseUp() {
    this.interaction = { type: "idle" };

    if (this.focusedShape) {
      this.focusedShape.state = "static";
      this.focusedShape = null;
      this.drawAll();
      this.drawOverlay();
    }
  }

  dispose() {}
}
