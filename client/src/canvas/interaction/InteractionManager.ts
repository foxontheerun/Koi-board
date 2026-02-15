import type { EntityManager } from "../entities/EntityManager";
import type { DragController } from "./DragController";
import type { ResizeController } from "./ResizeController";
import { ResizeCalculator } from "./ResizeCalculator";
import {
  hitTestResizeHandle,
  RESIZE_HANDLE_SIZE,
} from "../rendering/layers/mouseEventHandlingHelpers";
import type { InteractionMode, Point } from "../types";
import type { _Shape } from "../entities";

export class InteractionManager {
  private interaction: InteractionMode = { type: "idle", selectedId: null };
  private containerElement: HTMLElement | null = null;

  private onTransientUpdateCallback?: (shape: _Shape) => void;
  private onFinalUpdateCallback?: (shape: _Shape) => void;

  constructor(
    private entityManager: EntityManager,
    private dragController: DragController,
    private resizeController: ResizeController,
  ) {}

  setContainer(element: HTMLElement) {
    this.containerElement = element;
  }

  setCallbacks(callbacks: {
    onTransientUpdate?: (shape: _Shape) => void;
    onFinalUpdate?: (shape: _Shape) => void;
  }) {
    this.onTransientUpdateCallback = callbacks.onTransientUpdate;
    this.onFinalUpdateCallback = callbacks.onFinalUpdate;
  }

  getInteraction(): InteractionMode {
    return this.interaction;
  }

  getSelectedId(): string | null {
    return this.interaction.selectedId;
  }

  handleMouseDown(worldPoint: Point, canvasPoint: Point) {
    const shape = this.entityManager.findShapeAt(
      worldPoint,
      RESIZE_HANDLE_SIZE,
    );

    if (!shape) {
      this.interaction = {
        type: "select",
        startX: canvasPoint.x,
        startY: canvasPoint.y,
        currentX: canvasPoint.x,
        currentY: canvasPoint.y,
        selectedId: null,
      };
      this.entityManager.clearSelection();
      return;
    }

    this.selectShape(shape);

    const bound = ResizeCalculator.getShapeManipulationBounds(shape);
    const handle = hitTestResizeHandle(bound, worldPoint);

    if (handle) {
      this.resizeController.begin(shape, handle, worldPoint);
      this.interaction = {
        type: "resize",
        selectedId: shape.id,
        activeId: shape.id,
      };
      return;
    }

    this.dragController.begin(shape, worldPoint);
    this.interaction = {
      type: "drag",
      selectedId: shape.id,
      activeId: shape.id,
    };
  }

  handleMouseMove(worldPoint: Point, canvasPoint: Point) {
    if (this.interaction.type === "idle") {
      return;
    }

    if (this.interaction.type === "select") {
      this.interaction.currentX = canvasPoint.x;
      this.interaction.currentY = canvasPoint.y;
      return;
    }

    if (this.interaction.type === "pan") {
      return;
    }

    if (this.interaction.type === "drag") {
      const updatedShape = this.dragController.update(worldPoint);
      if (updatedShape) {
        this.entityManager.updateShapeList(updatedShape);
        this.onTransientUpdateCallback?.(updatedShape);
      }
      return;
    }

    if (this.interaction.type === "resize") {
      const updatedShape = this.resizeController.update(worldPoint);
      if (updatedShape) {
        this.entityManager.updateShapeList(updatedShape);
        this.onTransientUpdateCallback?.(updatedShape);
      }
      return;
    }
  }

  handleMouseUp() {
    if (this.interaction.type === "idle") {
      return;
    }

    const selectedId = this.interaction.selectedId;

    if (this.interaction.type === "pan") {
      this.interaction = { type: "idle", selectedId };
      this.removeCursorClass("cursor-grabbing");
      return;
    }

    if (this.interaction.type === "drag") {
      const finalShape = this.dragController.end();
      if (finalShape) {
        this.entityManager.updateShapeList(finalShape);
        this.onFinalUpdateCallback?.(finalShape);
      }
    }

    if (this.interaction.type === "resize") {
      const finalShape = this.resizeController.end();
      if (finalShape) {
        this.entityManager.updateShapeList(finalShape);
        this.onFinalUpdateCallback?.(finalShape);
      }
    }

    this.interaction = { type: "idle", selectedId };
  }

  handlePanStart(screenX: number, screenY: number) {
    const selectedId = this.interaction.selectedId;
    this.interaction = {
      type: "pan",
      startX: screenX,
      startY: screenY,
      selectedId,
    };
    this.addCursorClass("cursor-grabbing");
  }

  handlePanMove(screenX: number, screenY: number, camera: any): boolean {
    if (this.interaction.type !== "pan") return false;

    const dx = screenX - this.interaction.startX;
    const dy = screenY - this.interaction.startY;

    const state = camera.state;
    camera.setOffset(state.offsetX + dx, state.offsetY + dy);

    this.interaction.startX = screenX;
    this.interaction.startY = screenY;

    return true;
  }

  private selectShape(shape: _Shape) {
    this.entityManager.clearSelection();
    shape.state = "dragging";
  }

  private addCursorClass(className: string) {
    this.containerElement?.classList.add(className);
  }

  private removeCursorClass(className: string) {
    this.containerElement?.classList.remove(className);
  }
}
