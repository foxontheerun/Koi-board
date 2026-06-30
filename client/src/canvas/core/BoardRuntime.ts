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
import type { RemoteCursor } from "../types";
import { RenderOrchestrator } from "../rendering/RenderOrchestrator";
import { CollabController } from "../collab/CollabController";
import { ShapeCreationController } from "../interaction/ShapeCreationController";
import { ShapeCommands } from "./ShapeCommands";
import { PointerController } from "../interaction/PointerController";

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
  private pointer: PointerController;

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

    this.pointer = new PointerController(
      this.coordinateTransformer,
      this.interactionManager,
      this.camera,
      this.entityManager,
      this.collab,
      this.creation,
      this.renderOrchestrator,
      {
        onLocalCursor: (x, y) => this.syncCallbacks.onLocalCursor?.(x, y),
        onSelectionChange: (ids) => this.syncCallbacks.onSelectionChange?.(ids),
      },
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
    this.pointer.handleMouseDown(screenX, screenY);
  }

  handleMouseMove(screenX: number, screenY: number) {
    this.pointer.handleMouseMove(screenX, screenY);
  }

  handleMouseUp() {
    this.pointer.handleMouseUp();
  }

  handlePanStart(screenX: number, screenY: number) {
    this.pointer.handlePanStart(screenX, screenY);
  }

  private redrawAll() {
    this.renderOrchestrator.all();
  }

  destroy() {
    if (this.lockSweepTimer !== undefined) clearInterval(this.lockSweepTimer);
    this.unsubscribeCamera?.();
  }
}
