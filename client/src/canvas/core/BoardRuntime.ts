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

export class BoardRuntime {
  public camera: CameraController;

  private renderManager: RenderManager;
  private interactionManager: InteractionManager;
  private coordinateTransformer: CoordinateTransformer;

  public entityManager: EntityManager;
  private dragController: DragController;
  private resizeController: ResizeController;

  private unsubscribeCamera?: () => void;
  private activeStickyColor: StickyColorId = "yellow";

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

  setCreationTool(type: ShapeType | null) {
    this.creationTool.type = type;
    this.creationTool.startPoint = null;
    this.creationTool.previewShape = null;
  }

  setActiveStickyColor(colorId: StickyColorId) {
    this.activeStickyColor = colorId;
  }

  private syncCallbacks: {
    onLocalShapeTransient?: (shape: _Shape) => void;
    onLocalShapePersisted?: (shape: _Shape) => void;
  } = {};

  setSyncCallbacks(callbacks: {
    onLocalShapeTransient?: (shape: _Shape) => void;
    onLocalShapePersisted?: (shape: _Shape) => void;
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
    this.entityManager.applyTransientPatch(patch);
    this.redrawInteractionLayers();
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

    this.interactionManager.handleMouseDown(worldPoint, canvasPoint);
    this.redrawInteractionLayers();
  }

  handleMouseMove(screenX: number, screenY: number) {
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
    this.redrawInteractionLayers();
  }

  handleMouseUp() {
    if (this.creationTool.startPoint && this.creationTool.previewShape) {
      this.finishCreatingShape();
      return;
    }
    this.interactionManager.handleMouseUp();
    this.redrawInteractionLayers();
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

  private redrawAll() {
    const selectedId = this.interactionManager.getSelectedId();
    this.renderManager.drawAll(this.camera, this.entityManager, selectedId);
  }

  private redrawInteractionLayers() {
    const interaction = this.interactionManager.getInteraction();
    const selectedId = this.interactionManager.getSelectedId();

    if (interaction.type === "pan") return;

    const selectionBox =
      interaction.type === "select"
        ? {
            startX: interaction.startX,
            startY: interaction.startY,
            currentX: interaction.currentX,
            currentY: interaction.currentY,
          }
        : undefined;

    this.renderManager.drawStatic(this.camera, this.entityManager);
    this.renderManager.drawDrag(this.camera, this.entityManager);
    this.renderManager.drawOverlay(
      this.camera,
      this.entityManager,
      selectedId,
      selectionBox,
    );
  }

  private creationTool: {
    type: ShapeType | null;
    startPoint: { x: number; y: number } | null;
    previewShape: _Shape | null;
  } = {
    type: null,
    startPoint: null,
    previewShape: null,
  };

  private startCreatingShape(worldPoint: { x: number; y: number }) {
    this.creationTool.startPoint = worldPoint;

    const colorPreset = STICKY_PRESETS[this.activeStickyColor];

    this.creationTool.previewShape = {
      id: crypto.randomUUID(),
      type: this.creationTool.type!,
      x: worldPoint.x,
      y: worldPoint.y,
      width: 0,
      height: 0,
      fill: colorPreset.fill,
      stroke: colorPreset.stroke,
      state: "static",
      radius: 8,
      zIndex: this.entityManager.getMaxZIndex() + 1,
    };
  }

  destroy() {
    this.unsubscribeCamera?.();
  }
}
