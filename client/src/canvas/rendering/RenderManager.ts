import { GridLayer } from "./layers/GridLayer";
import { StaticLayer } from "./layers/StaticLayer";
import { DragLayer } from "./layers/DragLayer";
import { Overlay } from "./layers/Overlay";
import type { EntityManager } from "../entities/EntityManager";
import type { CameraController } from "../camera/CameraController";

export class RenderManager {
  private gridCtx: CanvasRenderingContext2D;
  private mainCtx: CanvasRenderingContext2D;
  private dragCtx: CanvasRenderingContext2D;
  private overlayCtx: CanvasRenderingContext2D;

  private gridCanvas: HTMLCanvasElement;
  private mainCanvas: HTMLCanvasElement;
  private dragCanvas: HTMLCanvasElement;
  private overlayCanvas: HTMLCanvasElement;

  private gridLayer = new GridLayer();
  private staticLayer = new StaticLayer();
  private dragLayer = new DragLayer();
  private overlay = new Overlay();

  constructor(
    gridCanvas: HTMLCanvasElement,
    mainCanvas: HTMLCanvasElement,
    dragCanvas: HTMLCanvasElement,
    overlayCanvas: HTMLCanvasElement,
  ) {
    this.gridCanvas = gridCanvas;
    this.mainCanvas = mainCanvas;
    this.dragCanvas = dragCanvas;
    this.overlayCanvas = overlayCanvas;

    this.gridCtx = gridCanvas.getContext("2d")!;
    this.mainCtx = mainCanvas.getContext("2d")!;
    this.dragCtx = dragCanvas.getContext("2d")!;
    this.overlayCtx = overlayCanvas.getContext("2d")!;
  }

  updateSize(rect: DOMRect) {
    [
      this.gridCanvas,
      this.mainCanvas,
      this.dragCanvas,
      this.overlayCanvas,
    ].forEach((canvas) => {
      canvas.width = rect.width;
      canvas.height = rect.height;
    });
  }

  getMainCanvas(): HTMLCanvasElement {
    return this.mainCanvas;
  }

  getOverlayCanvas(): HTMLCanvasElement {
    return this.overlayCanvas;
  }

  drawAll(
    camera: CameraController,
    entityManager: EntityManager,
    selectedId: string | null,
  ) {
    this.drawGrid(camera);
    this.drawStatic(camera, entityManager);
    this.drawDrag(camera, entityManager);
    this.drawOverlay(camera, entityManager, selectedId);
  }

  drawGrid(camera: CameraController) {
    this.gridCtx.clearRect(0, 0, this.gridCanvas.width, this.gridCanvas.height);
    this.gridLayer.draw(this.gridCtx, camera.state);
  }

  drawStatic(camera: CameraController, entityManager: EntityManager) {
    this.mainCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.mainCtx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);

    this.mainCtx.save();
    camera.applyTransform(this.mainCtx);
    this.staticLayer.draw(this.mainCtx, entityManager.getShapes());
    this.mainCtx.restore();
  }

  drawDrag(camera: CameraController, entityManager: EntityManager) {
    this.dragCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.dragCtx.clearRect(0, 0, this.dragCanvas.width, this.dragCanvas.height);

    const dragging = entityManager.getShapesOnDragLayer();
    if (!dragging || dragging.length === 0) return;

    this.dragCtx.save();
    camera.applyTransform(this.dragCtx);
    this.dragLayer.draw(this.dragCtx, dragging);
    this.dragCtx.restore();
  }

  drawOverlay(
    camera: CameraController,
    entityManager: EntityManager,
    selectedId: string | null,
    selectionBox?: {
      startX: number;
      startY: number;
      currentX: number;
      currentY: number;
    },
  ) {
    this.overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.overlayCtx.clearRect(
      0,
      0,
      this.overlayCanvas.width,
      this.overlayCanvas.height,
    );

    this.overlayCtx.save();
    camera.applyTransform(this.overlayCtx);

    if (selectedId) {
      const selected = entityManager.getById(selectedId);
      if (selected) {
        this.overlay.drawBounds(this.overlayCtx, selected, camera.getScale());
      }
    }

    this.overlayCtx.restore();

    if (selectionBox) {
      const { startX, startY, currentX, currentY } = selectionBox;
      this.overlay.drawSelectionRect(
        this.overlayCtx,
        startX,
        startY,
        currentX,
        currentY,
      );
    }
  }
}
