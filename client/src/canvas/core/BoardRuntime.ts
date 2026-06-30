import {
  STICKY_PRESETS,
  type ShapeType,
  type StickyColorId,
} from "../../entities/Shape";
import { CameraController } from "../camera";
import { EntityManager, type _Shape } from "../entities";
import type {
  RemoteShape,
  ShapeEventPayload,
  TransientShapePatch,
} from "../entities/EntityManager";

import { ResizeController, DragController } from "../interaction";
import { InteractionManager } from "../interaction/InteractionManager";
import { RenderManager } from "../rendering/RenderManager";
import { CoordinateTransformer } from "../utils/CoordinateTransformer";
import type { LockAction } from "../collab/types";
import { RESIZE_HANDLE_SIZE } from "../rendering/layers/mouseEventHandlingHelpers";
import type { RemoteCursor } from "../types";
import { RenderOrchestrator } from "../rendering/RenderOrchestrator";
import { CollabController } from "../collab/CollabController";

export class BoardRuntime {
  public camera: CameraController;

  private renderManager: RenderManager;
  private interactionManager: InteractionManager;
  private coordinateTransformer: CoordinateTransformer;
  private renderOrchestrator: RenderOrchestrator;

  public entityManager: EntityManager;
  private dragController: DragController;
  private resizeController: ResizeController;

  private collab: CollabController;

  private lockSweepTimer?: ReturnType<typeof setInterval>;

  private unsubscribeCamera?: () => void;
  private activeStickyColor: StickyColorId = "yellow";

  private activeShapeColor: { fill: string; stroke: string } = {
    fill: "#DBEAFE",
    stroke: "#93C5FD",
  };

  private creationTool: {
    type: ShapeType | null;
    startPoint: { x: number; y: number } | null;
    previewShape: _Shape | null;
  } = {
    type: null,
    startPoint: null,
    previewShape: null,
  };

  constructor(
    gridCanvas: HTMLCanvasElement,
    mainCanvas: HTMLCanvasElement,
    dragCanvas: HTMLCanvasElement,
    overlayCanvas: HTMLCanvasElement,
  ) {
    this.camera = new CameraController();
    this.entityManager = new EntityManager();
    this.collab = new CollabController(this.entityManager, {
      onLocalLock: (id, action) => this.syncCallbacks.onLocalLock?.(id, action),
      onRemoteCursors: (cursors) =>
        this.syncCallbacks.onRemoteCursors?.(cursors),
    });

    this.dragController = new DragController();
    this.resizeController = new ResizeController();

    this.renderManager = new RenderManager(
      gridCanvas,
      mainCanvas,
      dragCanvas,
      overlayCanvas,
    );

    this.interactionManager = new InteractionManager(
      this.entityManager,
      this.dragController,
      this.resizeController,
    );

    this.coordinateTransformer = new CoordinateTransformer(
      this.camera,
      mainCanvas,
      overlayCanvas,
    );

    this.renderOrchestrator = new RenderOrchestrator(
      this.renderManager,
      this.camera,
      this.entityManager,
      () => this.interactionManager.getSelectedIds(),
    );

    const container = overlayCanvas.parentElement;
    if (container) {
      this.interactionManager.setContainer(container);
    }

    this.unsubscribeCamera = this.camera.subscribe(() => {
      this.renderManager.invalidateDirtyRects();
      this.redrawAll();
    });

    this.updateSize();
    this.redrawAll();

    this.lockSweepTimer = setInterval(() => {
      const { shapesChanged } = this.collab.sweep();
      if (shapesChanged) {
        this.renderOrchestrator.staticLayer();
        this.renderOrchestrator.dragLayer();
      }
    }, 1000);
  }

  setCreationTool(type: ShapeType | null) {
    this.creationTool.type = type;
    this.creationTool.startPoint = null;
    this.creationTool.previewShape = null;
  }

  setActiveStickyColor(colorId: StickyColorId) {
    this.activeStickyColor = colorId;
  }

  setActiveShapeColor(fill: string, stroke: string) {
    this.activeShapeColor = { fill, stroke };
  }

  setClientId(clientId: string) {
    this.collab.setClientId(clientId);
  }

  applyRemoteLock(shapeId: string, clientId: string, action: LockAction) {
    this.collab.applyRemoteLock(shapeId, clientId, action);
  }

  renewRemoteLock(shapeId: string, clientId: string) {
    this.collab.renewRemoteLock(shapeId, clientId);
  }

  applyRemoteCursor(clientId: string, x: number, y: number) {
    this.collab.applyRemoteCursor(clientId, x, y);
  }

  private syncCallbacks: {
    onLocalShapeTransient?: (shape: _Shape) => void;
    onLocalShapePersisted?: (shape: _Shape) => void;
    onLocalLock?: (shapeId: string, action: LockAction) => void;
    onLocalShapeDeleted?: (shapeId: string) => void;
    onSelectionChange?: (ids: string[]) => void;
    onLocalCursor?: (x: number, y: number) => void;
    onRemoteCursors?: (cursors: RemoteCursor[]) => void;
  } = {};

  setSyncCallbacks(callbacks: {
    onLocalShapeTransient?: (shape: _Shape) => void;
    onLocalShapePersisted?: (shape: _Shape) => void;
    onLocalLock?: (shapeId: string, action: LockAction) => void;
    onLocalShapeDeleted?: (shapeId: string) => void;
    onSelectionChange?: (ids: string[]) => void;
    onLocalCursor?: (x: number, y: number) => void;
    onRemoteCursors?: (cursors: RemoteCursor[]) => void;
  }) {
    this.syncCallbacks = callbacks;

    this.interactionManager.setCallbacks({
      onTransientUpdate: callbacks.onLocalShapeTransient,
      onFinalUpdate: callbacks.onLocalShapePersisted,
    });
  }

  replaceAllShapes(shapes: RemoteShape[]) {
    this.entityManager.replaceAll(shapes);
    this.redrawAll();
  }

  applyTransientPatch(patch: TransientShapePatch) {
    this.applyTransientPatches([patch]);
  }

  applyTransientPatches(patches: TransientShapePatch[]) {
    let anyBecameRemote = false;

    for (const patch of patches) {
      if (this.collab.ownsShape(patch.id)) continue;

      const { becameRemote } = this.entityManager.applyTransientPatch(patch);
      if (becameRemote) anyBecameRemote = true;
    }

    if (anyBecameRemote) {
      // A shape just entered remote-dragging — redraw the static layer once
      // to remove it from mainCanvas.
      this.renderOrchestrator.staticLayer();
    }

    this.renderOrchestrator.dragLayer();
    this.renderOrchestrator.overlay();
  }

  applyShapeEvent(event: ShapeEventPayload) {
    this.entityManager.applyShapeEvent(event);
    this.redrawAll();
  }

  updateSize() {
    const rect = this.renderManager.getMainCanvas().getBoundingClientRect();
    this.renderManager.updateSize(rect);
    this.camera.updateViewport(this.renderManager.getMainCanvas());
    this.redrawAll();
  }

  findShapeAtScreen(screenX: number, screenY: number): _Shape | null {
    const worldPoint = this.coordinateTransformer.screenToWorld(
      screenX,
      screenY,
    );
    return this.entityManager.findShapeAt(worldPoint);
  }

  getShapeScreenRect(
    shape: _Shape,
  ): { x: number; y: number; w: number; h: number } | null {
    const topLeft = this.camera.worldToScreen(shape.x, shape.y);
    const bottomRight = this.camera.worldToScreen(
      shape.x + shape.width,
      shape.y + shape.height,
    );

    const canvasRect = this.renderManager
      .getMainCanvas()
      .getBoundingClientRect();

    return {
      x: topLeft.x + canvasRect.left,
      y: topLeft.y + canvasRect.top,
      w: bottomRight.x - topLeft.x,
      h: bottomRight.y - topLeft.y,
    };
  }

  updateShapeText(id: string, text: string) {
    const shape = this.entityManager.getById(id);
    if (!shape) return;

    shape.text = text;
    this.renderOrchestrator.staticLayer();
    this.syncCallbacks.onLocalShapePersisted?.(shape);
  }

  getSelectedIds(): string[] {
    return this.interactionManager.getSelectedIds();
  }

  getSelectionScreenRect(
    ids: string[],
  ): { x: number; y: number; w: number; h: number } | null {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const id of ids) {
      const shape = this.entityManager.getById(id);
      if (!shape) continue;
      minX = Math.min(minX, shape.x);
      minY = Math.min(minY, shape.y);
      maxX = Math.max(maxX, shape.x + shape.width);
      maxY = Math.max(maxY, shape.y + shape.height);
    }
    if (minX === Infinity) return null;

    const topLeft = this.camera.worldToScreen(minX, minY);
    const bottomRight = this.camera.worldToScreen(maxX, maxY);
    return {
      x: topLeft.x,
      y: topLeft.y,
      w: bottomRight.x - topLeft.x,
      h: bottomRight.y - topLeft.y,
    };
  }

  private notifySelection() {
    this.syncCallbacks.onSelectionChange?.(
      this.interactionManager.getSelectedIds(),
    );
  }

  areAllLocked(ids: string[]): boolean {
    if (ids.length === 0) return false;
    return ids.every((id) => this.entityManager.getById(id)?.locked === true);
  }

  private unlockedIds(ids: string[]): string[] {
    return ids.filter((id) => this.entityManager.getById(id)?.locked !== true);
  }

  toggleLock(ids: string[]) {
    const changed = this.entityManager.setLocked(ids, !this.areAllLocked(ids));
    if (changed.length === 0) return;
    this.redrawAll();
    changed.forEach((shape) =>
      this.syncCallbacks.onLocalShapePersisted?.(shape),
    );
    this.notifySelection();
  }

  bringToFront(ids: string[]) {
    this.applyZOrder(this.entityManager.bringToFront(this.unlockedIds(ids)));
  }

  sendToBack(ids: string[]) {
    this.applyZOrder(this.entityManager.sendToBack(this.unlockedIds(ids)));
  }

  moveForward(ids: string[]) {
    this.applyZOrder(this.entityManager.moveForward(this.unlockedIds(ids)));
  }

  moveBackward(ids: string[]) {
    this.applyZOrder(this.entityManager.moveBackward(this.unlockedIds(ids)));
  }

  private applyZOrder(changed: _Shape[]) {
    if (changed.length === 0) return;
    this.redrawAll();
    changed.forEach((shape) =>
      this.syncCallbacks.onLocalShapePersisted?.(shape),
    );
  }

  selectShape(id: string) {
    this.interactionManager.selectById(id);
    this.renderOrchestrator.staticLayer();
    this.renderOrchestrator.overlay();
  }

  deleteShapes(ids: string[]) {
    const removed = this.entityManager.removeShapes(this.unlockedIds(ids));
    if (removed.length === 0) return;
    this.interactionManager.selectById("");
    this.redrawAll();
    removed.forEach((id) => this.syncCallbacks.onLocalShapeDeleted?.(id));
    this.notifySelection();
  }

  handleMouseDown(screenX: number, screenY: number) {
    const worldPoint = this.coordinateTransformer.screenToWorld(
      screenX,
      screenY,
    );
    const canvasPoint = this.coordinateTransformer.screenToCanvas(
      screenX,
      screenY,
    );

    if (this.creationTool.type) {
      this.startCreatingShape(worldPoint);
      return;
    }

    const hit = this.entityManager.findShapeAt(worldPoint, RESIZE_HANDLE_SIZE);
    if (hit && this.collab.isLockedByOther(hit.id)) {
      return;
    }

    this.interactionManager.handleMouseDown(worldPoint, canvasPoint);

    const interaction = this.interactionManager.getInteraction();

    if (interaction.type === "drag" || interaction.type === "resize") {
      this.collab.acquire(this.interactionManager.getSelectedIds());
      this.renderOrchestrator.staticLayer();
      this.renderOrchestrator.dragLayer();
      this.renderOrchestrator.overlay();
    } else {
      this.renderOrchestrator.overlay();
    }

    this.notifySelection();
  }

  handleMouseMove(screenX: number, screenY: number) {
    const cursorWorld = this.coordinateTransformer.screenToWorld(
      screenX,
      screenY,
    );
    this.syncCallbacks.onLocalCursor?.(cursorWorld.x, cursorWorld.y);

    if (this.creationTool.startPoint) {
      const worldPoint = this.coordinateTransformer.screenToWorld(
        screenX,
        screenY,
      );
      this.updateShapePreview(worldPoint);
      return;
    }

    const isPanning = this.interactionManager.handlePanMove(
      screenX,
      screenY,
      this.camera,
    );

    if (isPanning) return;

    const worldPoint = this.coordinateTransformer.screenToWorld(
      screenX,
      screenY,
    );
    const canvasPoint = this.coordinateTransformer.screenToCanvas(
      screenX,
      screenY,
    );

    this.interactionManager.handleMouseMove(worldPoint, canvasPoint);

    const interaction = this.interactionManager.getInteraction();

    if (interaction.type === "pan" || interaction.type === "idle") return;

    if (interaction.type === "drag" || interaction.type === "resize") {
      this.collab.renew(this.interactionManager.getSelectedIds());
      this.renderOrchestrator.dragLayer();
      this.renderOrchestrator.overlay();
      return;
    }

    const selectionBox =
      interaction.type === "select"
        ? {
            startX: interaction.startX,
            startY: interaction.startY,
            currentX: interaction.currentX,
            currentY: interaction.currentY,
          }
        : undefined;

    this.renderOrchestrator.overlay(selectionBox);
  }

  handleMouseUp() {
    if (this.creationTool.startPoint && this.creationTool.previewShape) {
      this.finishCreatingShape();
      return;
    }

    const interactionBefore = this.interactionManager.getInteraction();
    const wasDragOrResize =
      interactionBefore.type === "drag" || interactionBefore.type === "resize";

    this.interactionManager.handleMouseUp();

    if (wasDragOrResize) {
      this.collab.release(interactionBefore.selectedIds);
      this.renderOrchestrator.staticLayer();
      this.renderOrchestrator.dragLayer();
      this.renderOrchestrator.overlay();
    } else {
      this.renderOrchestrator.overlay();
    }

    this.notifySelection();
  }

  handlePanStart(screenX: number, screenY: number) {
    this.interactionManager.handlePanStart(screenX, screenY);
  }

  private updateShapePreview(worldPoint: { x: number; y: number }) {
    if (!this.creationTool.startPoint || !this.creationTool.previewShape)
      return;

    const start = this.creationTool.startPoint;
    const width = worldPoint.x - start.x;
    const height = worldPoint.y - start.y;

    this.creationTool.previewShape = {
      ...this.creationTool.previewShape,
      width: Math.abs(width),
      height: Math.abs(height),
      x: width < 0 ? worldPoint.x : start.x,
      y: height < 0 ? worldPoint.y : start.y,
    };

    this.renderManager.drawOverlay(
      this.camera,
      this.entityManager,
      null,
      undefined,
      this.creationTool.previewShape,
    );
  }

  private finishCreatingShape() {
    if (!this.creationTool.previewShape) return;

    const shape = this.creationTool.previewShape;

    if (shape.width < 10 || shape.height < 10) {
      shape.width = Math.max(shape.width, 100);
      shape.height = Math.max(shape.height, 100);
    }

    this.entityManager.addShape(shape);
    this.syncCallbacks.onLocalShapePersisted?.(shape);

    this.creationTool.startPoint = null;
    this.creationTool.previewShape = null;
    this.creationTool.type = null;

    this.redrawAll();
  }

  private startCreatingShape(worldPoint: { x: number; y: number }) {
    this.creationTool.startPoint = worldPoint;

    const isSticky = this.creationTool.type === "STICKER";
    const color = isSticky
      ? STICKY_PRESETS[this.activeStickyColor]
      : this.activeShapeColor;

    this.creationTool.previewShape = {
      id: crypto.randomUUID(),
      type: this.creationTool.type!,
      x: worldPoint.x,
      y: worldPoint.y,
      width: 0,
      height: 0,
      fill: color.fill,
      stroke: color.stroke,
      state: "static",
      radius: this.creationTool.type === "RECT" ? 8 : 0,
      zIndex: this.entityManager.getMaxZIndex() + 1,
    };
  }

  private redrawAll() {
    this.renderOrchestrator.all();
  }

  destroy() {
    if (this.lockSweepTimer !== undefined) clearInterval(this.lockSweepTimer);
    this.unsubscribeCamera?.();
  }
}
