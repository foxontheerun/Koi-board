import type { CameraController } from "../camera";
import type { _Shape, EntityManager } from "../entities";
import type { RenderManager } from "./RenderManager";

export type selectionBox =
  | {
      startX: number;
      startY: number;
      currentX: number;
      currentY: number;
    }
  | undefined;

export class RenderOrchestrator {
  constructor(
    private readonly renderManager: RenderManager,
    private readonly camera: CameraController,
    private readonly entityManager: EntityManager,
    private readonly getSelectedIds: () => string[],
  ) {}

  all() {
    this.renderManager.drawAll(
      this.camera,
      this.entityManager,
      this.getSelectedIds(),
    );
  }

  staticLayer() {
    this.renderManager.drawStatic(this.camera, this.entityManager);
  }

  dragLayer() {
    this.renderManager.drawDrag(this.camera, this.entityManager);
  }

  overlay(selectionBox?: selectionBox, preview?: _Shape) {
    this.renderManager.drawOverlay(
      this.camera,
      this.entityManager,
      this.getSelectedIds(),
      selectionBox,
      preview,
    );
  }
}
