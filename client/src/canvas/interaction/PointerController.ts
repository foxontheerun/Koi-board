import type { CameraController } from "../camera";
import type { EntityManager } from "../entities";
import type { CoordinateTransformer } from "../utils/CoordinateTransformer";
import type { InteractionManager } from "./InteractionManager";
import type { CollabController } from "../collab/CollabController";
import type { ShapeCreationController } from "./ShapeCreationController";
import type { RenderOrchestrator } from "../rendering/RenderOrchestrator";
import { RESIZE_HANDLE_SIZE } from "../rendering/layers/mouseEventHandlingHelpers";

interface PointerCallbacks {
  onLocalCursor: (x: number, y: number) => void;
  onSelectionChange: (ids: string[]) => void;
}

export class PointerController {
  constructor(
    private readonly coordinateTransformer: CoordinateTransformer,
    private readonly interactionManager: InteractionManager,
    private readonly camera: CameraController,
    private readonly entityManager: EntityManager,
    private readonly collab: CollabController,
    private readonly creation: ShapeCreationController,
    private readonly render: RenderOrchestrator,
    private readonly callbacks: PointerCallbacks,
  ) {}

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
      this.render.staticLayer();
      this.render.dragLayer();
      this.render.overlay();
    } else {
      this.render.overlay();
    }

    this.notifySelection();
  }

  handleMouseMove(screenX: number, screenY: number) {
    const cursorWorld = this.coordinateTransformer.screenToWorld(
      screenX,
      screenY,
    );
    this.callbacks.onLocalCursor(cursorWorld.x, cursorWorld.y);

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
      this.render.dragLayer();
      this.render.overlay();
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

    this.render.overlay(selectionBox);
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
      this.render.staticLayer();
      this.render.dragLayer();
      this.render.overlay();
    } else {
      this.render.overlay();
    }

    this.notifySelection();
  }

  handlePanStart(screenX: number, screenY: number) {
    this.interactionManager.handlePanStart(screenX, screenY);
  }

  private notifySelection() {
    this.callbacks.onSelectionChange(this.interactionManager.getSelectedIds());
  }
}
