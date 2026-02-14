import { CameraController } from "./CameraController";
import { GridLayer } from "../layers/GridLayer";
import { StaticLayer } from "../layers/StaticLayer";
import { DragLayer } from "../layers/DragLayer";
import { EntityManager, type _Shape } from "../model/EntityManager";
import { Overlay } from "../layers/Overlay";
import { type InteractionMode } from "../model/types";
import {
  hitTestResizeHandle,
  RESIZE_HANDLE_SIZE,
} from "../model/mouseEventHandlingHelpers";
import { ResizeCalculator } from "./ResizeCalculator";
import { ResizeController } from "./ResizeController";
import { DragController } from "./DragController";

export class BoardRuntime {
  public camera = new CameraController();
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
  resizeController = new ResizeController();
  dragController = new DragController();

  private interaction: InteractionMode = { type: "idle" };

  constructor(
    gridCanvas: HTMLCanvasElement,
    mainCanvas: HTMLCanvasElement,
    drag: HTMLCanvasElement,
    overlay: HTMLCanvasElement,
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
    const dragging = this.entityManager.getShapesOnDragLayer();

    if (!dragging) return;

    this.dragLayer.draw(this.dragCtx, dragging);

    this.dragCtx.restore();
  }

  drawOverlay() {
    this.overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.overlayCtx.clearRect(
      0,
      0,
      this.overlayCanvas.width,
      this.overlayCanvas.height,
    );

    this.overlayCtx.save();
    this.camera.applyTransform(this.overlayCtx);
    const dragging = this.entityManager.getDraggedShape();
    if (dragging) {
      this.overlay.drawBounds(
        this.overlayCtx,
        dragging,
        this.camera.getScale(),
      );
    }

    this.overlayCtx.restore();

    // if (this.interaction.type === "select") {
    //   const { startX, startY, currentX, currentY } = this.interaction;
    //   this.overlay.drawSelectionRect(
    //     this.overlayCtx,
    //     startX,
    //     startY,
    //     currentX,
    //     currentY,
    //   );
    // }
  }

  private getCanvasCoordinates(screenX: number, screenY: number) {
    const rect = this.overlayCanvas.getBoundingClientRect();
    return {
      x: (screenX - rect.left) * (this.overlayCanvas.width / rect.width),
      y: (screenY - rect.top) * (this.overlayCanvas.height / rect.height),
    };
  }

  handleMouseDown(screenX: number, screenY: number) {
    const worldPoint = this.getWorldPoint(screenX, screenY);
    const shape = this.entityManager.findShapeAt(
      worldPoint,
      RESIZE_HANDLE_SIZE,
    );

    if (!shape) {
      const pos = this.getCanvasCoordinates(screenX, screenY);

      this.interaction = {
        type: "select",
        startX: pos.x,
        startY: pos.y,
        currentX: pos.x,
        currentY: pos.y,
      };
      this.entityManager.getShapes().forEach((s) => (s.state = "static"));

      this.drawOverlay();
      this.drawStatic();
      this.drawDrag();
      return;
    }

    const bound = ResizeCalculator.getShapeManipulationBounds(shape);
    const handle = hitTestResizeHandle(bound, worldPoint);
    if (handle) {
      this.resizeController.begin(shape, handle, worldPoint);
      this.interaction = { type: "resize" };
      this.drawOverlay();
      return;
    }

    this.dragController.begin(shape, worldPoint);
    this.interaction = { type: "drag", shape };
    this.drawStatic();
    this.drawDrag();
    this.drawOverlay();
  }

  handleMouseMove(screenX: number, screenY: number) {
    if (this.interaction.type === "idle") return;

    if (this.interaction.type === "select") {
      const pos = this.getCanvasCoordinates(screenX, screenY);
      this.interaction.currentX = pos.x;
      this.interaction.currentY = pos.y;
      this.drawOverlay();
      return;
    }

    if (this.interaction.type === "pan") {
      const dx = screenX - this.interaction.startX;
      const dy = screenY - this.interaction.startY;

      const state = this.camera.state;

      this.camera.setOffset(state.offsetX + dx, state.offsetY + dy);

      this.interaction.startX = screenX;
      this.interaction.startY = screenY;

      return;
    }

    const worldPoint = this.getWorldPoint(screenX, screenY);

    if (this.interaction.type === "drag") {
      this.applyDrag(worldPoint);
    } else if (this.interaction.type === "resize") {
      const newShape = this.resizeController.update(worldPoint);

      if (newShape) {
        this.entityManager.updateShapeList(newShape);
      }
    }

    this.drawDrag();
    this.drawOverlay();
  }

  handleMouseUp() {
    if (this.interaction.type === "idle") return;

    if (this.interaction.type === "pan") {
      this.interaction = { type: "idle" };
      const container = this.overlayCanvas.parentElement;
      if (container) container.classList.remove("cursor-grabbing");
      return;
    }

    if (this.interaction.type === "resize") {
      this.resizeController.end();
    }

    this.interaction = { type: "idle" };

    this.drawOverlay();
    this.drawDrag();
    this.drawStatic();
  }

  handlePanStart(screenX: number, screenY: number) {
    this.interaction = { type: "pan", startX: screenX, startY: screenY };
    const container = this.overlayCanvas.parentElement;
    if (container) container.classList.add("cursor-grabbing");
  }

  applyDrag(worldPoint: { x: number; y: number }) {
    const updatedShape = this.dragController.update(worldPoint);

    if (updatedShape) {
      this.entityManager.updateShapeList(updatedShape);
    }
  }

  private getWorldPoint(
    screenX: number,
    screenY: number,
  ): { x: number; y: number } {
    const rect = this.mainCanvas.getBoundingClientRect();
    return this.camera.screenToWorld(screenX - rect.left, screenY - rect.top);
  }
}
