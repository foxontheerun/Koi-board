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

export class BoardRuntime {
  public camera: CameraController;

  private renderManager: RenderManager;
  private interactionManager: InteractionManager;
  private coordinateTransformer: CoordinateTransformer;

  public entityManager: EntityManager;
  private dragController: DragController;
  private resizeController: ResizeController;

  private unsubscribeCamera?: () => void;

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
      this.redrawAll();
    });

    this.updateSize();
    this.redrawAll();
  }

  setSyncCallbacks(callbacks: {
    onLocalShapeTransient?: (shape: _Shape) => void;
    onLocalShapePersisted?: (shape: _Shape) => void;
  }) {
    this.interactionManager.setCallbacks({
      onTransientUpdate: callbacks.onLocalShapeTransient,
      onFinalUpdate: callbacks.onLocalShapePersisted,
    });
  }

  // ✅ Apollo → Canvas: Replace all shapes (initial load)
  replaceAllShapes(shapes: RemoteShape[]) {
    this.entityManager.replaceAll(shapes);
    this.redrawAll();
  }

  // ✅ Apollo → Canvas: Apply transient patch (other users dragging)
  applyTransientPatch(patch: TransientShapePatch) {
    this.entityManager.applyTransientPatch(patch);
    this.redrawInteractionLayers();
  }

  // ✅ Apollo → Canvas: Apply shape event (other users saved)
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

  handleMouseDown(screenX: number, screenY: number) {
    const worldPoint = this.coordinateTransformer.screenToWorld(
      screenX,
      screenY,
    );
    const canvasPoint = this.coordinateTransformer.screenToCanvas(
      screenX,
      screenY,
    );

    this.interactionManager.handleMouseDown(worldPoint, canvasPoint);
    this.redrawInteractionLayers();
  }

  handleMouseMove(screenX: number, screenY: number) {
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
    this.redrawInteractionLayers();
  }

  handleMouseUp() {
    this.interactionManager.handleMouseUp();
    this.redrawInteractionLayers();
  }

  handlePanStart(screenX: number, screenY: number) {
    this.interactionManager.handlePanStart(screenX, screenY);
  }

  private redrawAll() {
    const selectedId = this.interactionManager.getSelectedId();
    this.renderManager.drawAll(this.camera, this.entityManager, selectedId);
  }

  private redrawInteractionLayers() {
    const interaction = this.interactionManager.getInteraction();
    const selectedId = this.interactionManager.getSelectedId();

    const selectionBox =
      interaction.type === "select"
        ? {
            startX: interaction.startX,
            startY: interaction.startY,
            currentX: interaction.currentX,
            currentY: interaction.currentY,
          }
        : undefined;

    switch (interaction.type) {
      case "idle":
        this.renderManager.drawStatic(this.camera, this.entityManager);
        this.renderManager.drawDrag(this.camera, this.entityManager);
        this.renderManager.drawOverlay(
          this.camera,
          this.entityManager,
          selectedId,
          selectionBox,
        );
        break;

      case "select":
        this.renderManager.drawStatic(this.camera, this.entityManager);
        this.renderManager.drawDrag(this.camera, this.entityManager);
        this.renderManager.drawOverlay(
          this.camera,
          this.entityManager,
          selectedId,
          selectionBox,
        );
        break;

      case "drag":
      case "resize":
        this.renderManager.drawStatic(this.camera, this.entityManager);
        this.renderManager.drawDrag(this.camera, this.entityManager);
        this.renderManager.drawOverlay(
          this.camera,
          this.entityManager,
          selectedId,
          selectionBox,
        );
        break;

      case "pan":
        break;
    }
  }

  destroy() {
    this.unsubscribeCamera?.();
  }
}
