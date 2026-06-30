import type { ShapeType, StickyColorId } from "../../entities/Shape";
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
import { ShapeCreationController } from "../interaction/ShapeCreationController";
import { ShapeCommands } from "./ShapeCommands";

export class BoardRuntime {
  public camera: CameraController;

  private renderManager: RenderManager;
  private interactionManager: InteractionManager;
  private coordinateTransformer: CoordinateTransformer;
  private renderOrchestrator: RenderOrchestrator;

  public entityManager: EntityManager;
  private dragController: DragController;
  private resizeController: ResizeController;
  private creation: ShapeCreationController;
  private collab: CollabController;

  private lockSweepTimer?: ReturnType<typeof setInterval>;
  private shapeCommands: ShapeCommands;

  private unsubscribeCamera?: () => void;

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

    this.shapeCommands = new ShapeCommands(
      this.entityManager,
      this.renderOrchestrator,
      this.interactionManager,
      {
        onPersist: (shape) => this.syncCallbacks.onLocalShapePersisted?.(shape),
        onDelete: (id) => this.syncCallbacks.onLocalShapeDeleted?.(id),
        onSelectionChange: (ids) => this.syncCallbacks.onSelectionChange?.(ids),
      },
    );

    this.creation = new ShapeCreationController(
      this.entityManager,
      this.renderOrchestrator,
      (shape) => this.syncCallbacks.onLocalShapePersisted?.(shape),
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
    this.creation.setTool(type);
  }

  setActiveStickyColor(colorId: StickyColorId) {
    this.creation.setStickyColor(colorId);
  }

  setActiveShapeColor(fill: string, stroke: string) {
    this.creation.setShapeColor(fill, stroke);
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
    this.shapeCommands.updateShapeText(id, text);
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
    return this.shapeCommands.areAllLocked(ids);
  }

  toggleLock(ids: string[]) {
    this.shapeCommands.toggleLock(ids);
  }

  bringToFront(ids: string[]) {
    this.shapeCommands.bringToFront(ids);
  }

  sendToBack(ids: string[]) {
    this.shapeCommands.sendToBack(ids);
  }

  moveForward(ids: string[]) {
    this.shapeCommands.moveForward(ids);
  }

  moveBackward(ids: string[]) {
    this.shapeCommands.moveBackward(ids);
  }

  selectShape(id: string) {
    this.interactionManager.selectById(id);
    this.renderOrchestrator.staticLayer();
    this.renderOrchestrator.overlay();
  }

  deleteShapes(ids: string[]) {
    this.shapeCommands.deleteShapes(ids);
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

    if (this.creation.hasTool()) {
      this.creation.begin(worldPoint);
      return;
    }

    const scale = this.camera.getScale();
    const hit = this.entityManager.findShapeAt(
      worldPoint,
      RESIZE_HANDLE_SIZE / scale,
    );
    if (hit && this.collab.isLockedByOther(hit.id)) {
      return;
    }

    this.interactionManager.handleMouseDown(worldPoint, canvasPoint, scale);

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

    if (this.creation.isCreating()) {
      const worldPoint = this.coordinateTransformer.screenToWorld(
        screenX,
        screenY,
      );
      this.creation.updatePreview(worldPoint);
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
    if (this.creation.isCreating() && this.creation.hasPreview()) {
      this.creation.finish();
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

  private redrawAll() {
    this.renderOrchestrator.all();
  }

  destroy() {
    if (this.lockSweepTimer !== undefined) clearInterval(this.lockSweepTimer);
    this.unsubscribeCamera?.();
  }
}
