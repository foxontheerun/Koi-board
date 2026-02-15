import { CameraController } from "../camera";
import type { StickyColorId, Tool } from "../../entities/Shape";
import { STICKY_PRESETS } from "../../entities/Shape";
import { type InteractionMode } from "../entities";
import {
  EntityManager,
  type RemoteShape,
  type ShapeEventPayload,
  type TransientShapePatch,
  type _Shape,
} from "../entities/EntityManager";
import {
  ResizeController,
  DragController,
  ResizeCalculator,
} from "../interaction";
import { GridLayer, StaticLayer, DragLayer, Overlay } from "../rendering";
import {
  RESIZE_HANDLE_SIZE,
  hitTestResizeHandle,
} from "../rendering/layers/mouseEventHandlingHelpers";

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
  private selectedShapeIds = new Set<string>();
  private activeTool: Tool = "pointer";
  private activeStickyColor: StickyColorId = "yellow";

  private onLocalShapeTransient?: (shape: _Shape) => void;
  private onLocalShapePersisted?: (shape: _Shape) => void;

  setActiveTool(tool: Tool) {
    this.activeTool = tool;
  }

  setActiveStickyColor(color: StickyColorId) {
    this.activeStickyColor = color;
  }

  private createShapeAt(worldPoint: { x: number; y: number }, type: "RECT" | "ELLIPSE") {
    const preset = STICKY_PRESETS[this.activeStickyColor];

    const newShape: _Shape = {
      id: crypto.randomUUID(),
      x: worldPoint.x - 80,
      y: worldPoint.y - 60,
      width: 160,
      height: 120,
      fill: preset.fill,
      stroke: preset.stroke,
      state: "static",
      type,
      radius: type === "RECT" ? 8 : 0,
      zIndex: this.entityManager.getNextZIndex(),
    };

    this.entityManager.addShape(newShape);
    this.selectedShapeIds = new Set([newShape.id]);
    this.onLocalShapePersisted?.(newShape);
    this.drawAll();
  }

  private getSelectedShapes() {
    const selectedIds = this.selectedShapeIds;
    return this.entityManager
      .getShapes()
      .filter((shape) => selectedIds.has(shape.id));
  }

  private isShapeInsideSelection(
    shape: _Shape,
    rect: { minX: number; minY: number; maxX: number; maxY: number },
  ) {
    const shapeMinX = shape.x;
    const shapeMinY = shape.y;
    const shapeMaxX = shape.x + shape.width;
    const shapeMaxY = shape.y + shape.height;

    return !(
      shapeMaxX < rect.minX ||
      shapeMinX > rect.maxX ||
      shapeMaxY < rect.minY ||
      shapeMinY > rect.maxY
    );
  }

  setSyncCallbacks(callbacks: {
    onLocalShapeTransient?: (shape: _Shape) => void;
    onLocalShapePersisted?: (shape: _Shape) => void;
  }) {
    this.onLocalShapeTransient = callbacks.onLocalShapeTransient;
    this.onLocalShapePersisted = callbacks.onLocalShapePersisted;
  }

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


  replaceAllShapes(shapes: RemoteShape[]) {
    this.entityManager.replaceAll(shapes);

    const existingIds = new Set(this.entityManager.getShapes().map((shape) => shape.id));
    this.selectedShapeIds = new Set(
      [...this.selectedShapeIds].filter((id) => existingIds.has(id)),
    );

    this.drawAll();
  }

  applyTransientPatch(patch: TransientShapePatch) {
    this.entityManager.applyTransientPatch(patch);
    this.drawDrag();
    this.drawOverlay();
    this.drawStatic();
  }

  applyShapeEvent(event: ShapeEventPayload) {
    this.entityManager.applyShapeEvent(event);

    if (event.type === "DELETED") {
      this.selectedShapeIds.delete(event.shape.id);
    }

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
    } else {
      this.getSelectedShapes().forEach((shape) => {
        this.overlay.drawBounds(this.overlayCtx, shape, this.camera.getScale());
      });
    }

    if (this.interaction.type === "select") {
      const { startX, startY, currentX, currentY } = this.interaction;
      this.overlay.drawSelectionRect(
        this.overlayCtx,
        startX,
        startY,
        currentX,
        currentY,
      );
    }

    this.overlayCtx.restore();
  }


  handleMouseDown(screenX: number, screenY: number, shiftKey = false) {
    const worldPoint = this.getWorldPoint(screenX, screenY);

    if (this.activeTool === "rectangle") {
      this.createShapeAt(worldPoint, "RECT");
      return;
    }

    if (this.activeTool === "ellipse") {
      this.createShapeAt(worldPoint, "ELLIPSE");
      return;
    }

    const shape = this.entityManager.findShapeAt(
      worldPoint,
      RESIZE_HANDLE_SIZE,
    );

    if (!shape) {
      this.selectedShapeIds.clear();

      this.interaction = {
        type: "select",
        startX: worldPoint.x,
        startY: worldPoint.y,
        currentX: worldPoint.x,
        currentY: worldPoint.y,
      };
      this.entityManager.getShapes().forEach((s) => (s.state = "static"));

      this.drawOverlay();
      this.drawStatic();
      this.drawDrag();
      return;
    }

    if (shiftKey) {
      if (this.selectedShapeIds.has(shape.id)) {
        this.selectedShapeIds.delete(shape.id);
      } else {
        this.selectedShapeIds.add(shape.id);
      }
    } else {
      this.selectedShapeIds = new Set([shape.id]);
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
      const worldPoint = this.getWorldPoint(screenX, screenY);
      this.interaction.currentX = worldPoint.x;
      this.interaction.currentY = worldPoint.y;
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
        this.onLocalShapeTransient?.(newShape);
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

    if (this.interaction.type === "select") {
      const { startX, startY, currentX, currentY } = this.interaction;
      const rect = {
        minX: Math.min(startX, currentX),
        minY: Math.min(startY, currentY),
        maxX: Math.max(startX, currentX),
        maxY: Math.max(startY, currentY),
      };

      const selectedIds = this.entityManager
        .getShapes()
        .filter((shape) => this.isShapeInsideSelection(shape, rect))
        .map((shape) => shape.id);

      this.selectedShapeIds = new Set(selectedIds);
    }

    if (this.interaction.type === "resize") {
      const finalShape = this.resizeController.end();
      if (finalShape) {
        this.entityManager.updateShapeList(finalShape);
        this.onLocalShapePersisted?.(finalShape);
      }
    }

    if (this.interaction.type === "drag") {
      const finalShape = this.dragController.end();
      if (finalShape) {
        this.entityManager.updateShapeList(finalShape);
        this.onLocalShapePersisted?.(finalShape);
      }
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
      this.onLocalShapeTransient?.(updatedShape);
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
