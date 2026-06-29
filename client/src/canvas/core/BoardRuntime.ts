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
import { LockManager } from "../collab/LockManager";
import type { LockAction } from "../collab/types";
import { RESIZE_HANDLE_SIZE } from "../rendering/layers/mouseEventHandlingHelpers";
import type { RemoteCursor } from "../types";
import { PresenceManager } from "../collab/PresenceManager";

export class BoardRuntime {
  public camera: CameraController;

  private renderManager: RenderManager;
  private interactionManager: InteractionManager;
  private coordinateTransformer: CoordinateTransformer;

  public entityManager: EntityManager;
  private dragController: DragController;
  private resizeController: ResizeController;
  private lockManager = new LockManager();
  private clientId: string | null = null;
  private lockSweepTimer?: ReturnType<typeof setInterval>;

  private presenceManager = new PresenceManager();

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

    this.lockSweepTimer = setInterval(() => this.sweepStaleLocks(), 1000);
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
    this.clientId = clientId;
  }

  private acquireLocks(ids: string[]) {
    const clientId = this.clientId;
    if (!clientId) return;
    const now = Date.now();
    ids.forEach((id) => {
      if (this.lockManager.acquire(id, clientId, now)) {
        this.syncCallbacks.onLocalLock?.(id, "ACQUIRE");
      }
    });
  }

  private renewLocks(ids: string[]) {
    const clientId = this.clientId;
    if (!clientId) return;
    const now = Date.now();
    ids.forEach((id) => this.lockManager.renew(id, clientId, now));
  }

  private releaseLocks(ids: string[]) {
    const clientId = this.clientId;
    if (!clientId) return;
    ids.forEach((id) => {
      this.lockManager.release(id, clientId);
      this.syncCallbacks.onLocalLock?.(id, "RELEASE");
    });
  }

  applyRemoteLock(shapeId: string, clientId: string, action: LockAction) {
    if (action === "ACQUIRE") {
      this.lockManager.acquire(shapeId, clientId, Date.now());
    } else {
      this.lockManager.release(shapeId, clientId);
    }
  }

  renewRemoteLock(shapeId: string, clientId: string) {
    this.lockManager.acquire(shapeId, clientId, Date.now());
  }

  applyRemoteCursor(clientId: string, x: number, y: number) {
    this.presenceManager.setCursor(clientId, x, y, Date.now());
    this.emitRemoteCursors();
  }

  private emitRemoteCursors() {
    this.syncCallbacks.onRemoteCursors?.(this.presenceManager.getCursors());
  }

  private sweepStaleLocks() {
    const now = Date.now();
    this.lockManager.sweepExpired(now);

    let changed = false;
    for (const shape of this.entityManager.getShapes()) {
      if (
        shape.state === "remote-dragging" &&
        this.lockManager.getOwner(shape.id, now) === null
      ) {
        shape.state = "static";
        changed = true;
      }
    }

    if (changed) {
      this.renderManager.drawStatic(this.camera, this.entityManager);
      this.renderManager.drawDrag(this.camera, this.entityManager);
    }

    if (this.presenceManager.sweepExpired(now)) this.emitRemoteCursors();
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
    const now = Date.now();
    let anyBecameRemote = false;

    for (const patch of patches) {
      if (
        this.clientId !== null &&
        this.lockManager.getOwner(patch.id, now) === this.clientId
      ) {
        continue;
      }

      const { becameRemote } = this.entityManager.applyTransientPatch(patch);
      if (becameRemote) anyBecameRemote = true;
    }

    if (anyBecameRemote) {
      // A shape just entered remote-dragging — redraw the static layer once
      // to remove it from mainCanvas.
      this.renderManager.drawStatic(this.camera, this.entityManager);
    }

    this.renderManager.drawDrag(this.camera, this.entityManager);
    this.renderManager.drawOverlay(
      this.camera,
      this.entityManager,
      this.interactionManager.getSelectedIds(),
    );
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

  // Returns the shape at the given screen coordinates.
  findShapeAtScreen(screenX: number, screenY: number): _Shape | null {
    const worldPoint = this.coordinateTransformer.screenToWorld(
      screenX,
      screenY,
    );
    return this.entityManager.findShapeAt(worldPoint);
  }

  // Returns the shape bounding rect in screen coordinates.
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

  // Updates shape text locally and persists it.
  updateShapeText(id: string, text: string) {
    const shape = this.entityManager.getById(id);
    if (!shape) return;

    shape.text = text;
    this.renderManager.drawStatic(this.camera, this.entityManager);
    this.syncCallbacks.onLocalShapePersisted?.(shape);
  }

  getSelectedIds(): string[] {
    return this.interactionManager.getSelectedIds();
  }

  // Screen-space bounding box of the selection, used to anchor the toolbar.
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

  // Locked shapes are protected from layer changes and deletion.
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
    this.renderManager.drawStatic(this.camera, this.entityManager);
    this.renderManager.drawOverlay(
      this.camera,
      this.entityManager,
      this.interactionManager.getSelectedIds(),
    );
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
    if (
      hit &&
      this.clientId !== null &&
      this.lockManager.isLockedByOther(hit.id, this.clientId, Date.now())
    ) {
      return;
    }

    this.interactionManager.handleMouseDown(worldPoint, canvasPoint);

    const interaction = this.interactionManager.getInteraction();

    if (interaction.type === "drag" || interaction.type === "resize") {
      this.acquireLocks(this.interactionManager.getSelectedIds());
      this.renderManager.drawStatic(this.camera, this.entityManager);
      this.renderManager.drawDrag(this.camera, this.entityManager);
      this.renderManager.drawOverlay(
        this.camera,
        this.entityManager,
        this.interactionManager.getSelectedIds(),
      );
    } else {
      this.renderManager.drawOverlay(
        this.camera,
        this.entityManager,
        this.interactionManager.getSelectedIds(),
      );
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
      this.renewLocks(this.interactionManager.getSelectedIds());
      this.renderManager.drawDrag(this.camera, this.entityManager);
      this.renderManager.drawOverlay(
        this.camera,
        this.entityManager,
        this.interactionManager.getSelectedIds(),
      );
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

    this.renderManager.drawOverlay(
      this.camera,
      this.entityManager,
      this.interactionManager.getSelectedIds(),
      selectionBox,
    );
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
      this.releaseLocks(interactionBefore.selectedIds);
      this.renderManager.drawStatic(this.camera, this.entityManager);
      this.renderManager.drawDrag(this.camera, this.entityManager);
      this.renderManager.drawOverlay(
        this.camera,
        this.entityManager,
        this.interactionManager.getSelectedIds(),
      );
    } else {
      this.renderManager.drawOverlay(
        this.camera,
        this.entityManager,
        this.interactionManager.getSelectedIds(),
      );
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
    const selectedIds = this.interactionManager.getSelectedIds();
    this.renderManager.drawAll(this.camera, this.entityManager, selectedIds);
  }

  destroy() {
    if (this.lockSweepTimer !== undefined) clearInterval(this.lockSweepTimer);
    this.unsubscribeCamera?.();
  }
}
