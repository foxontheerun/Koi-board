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
  private interaction: InteractionMode = { type: "idle", selectedIds: [] };
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

  getSelectedIds(): string[] {
    return this.interaction.selectedIds;
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
        startWorldX: worldPoint.x,
        startWorldY: worldPoint.y,
        currentWorldX: worldPoint.x,
        currentWorldY: worldPoint.y,
        selectedIds: [],
      };
      this.entityManager.clearSelection();
      return;
    }

    const selectedIds = this.getSelectedIds();
    const isSelected = selectedIds.includes(shape.id);
    if (!isSelected) {
      this.selectShapes([shape]);
    }

    const bound = ResizeCalculator.getShapeManipulationBounds(shape);
    const handle = hitTestResizeHandle(bound, worldPoint);

    if (handle) {
      this.resizeController.begin(shape, handle, worldPoint);
      this.interaction = {
        type: "resize",
        selectedIds: [shape.id],
        activeId: shape.id,
      };
      return;
    }

    const dragShapes = isSelected
      ? this.entityManager
          .getShapes()
          .filter((candidate) => selectedIds.includes(candidate.id))
      : [shape];

    this.dragController.begin(dragShapes, worldPoint);
    this.interaction = {
      type: "drag",
      selectedIds: dragShapes.map((s) => s.id),
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
      this.interaction.currentWorldX = worldPoint.x;
      this.interaction.currentWorldY = worldPoint.y;
      return;
    }

    if (this.interaction.type === "pan") {
      return;
    }

    if (this.interaction.type === "drag") {
      const updatedShapes = this.dragController.update(worldPoint);
      updatedShapes.forEach((shape) => {
        this.entityManager.updateShapeList(shape);
        this.onTransientUpdateCallback?.(shape);
      });
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

    const selectedIds = this.interaction.selectedIds;

    if (this.interaction.type === "pan") {
      this.interaction = { type: "idle", selectedIds };
      this.removeCursorClass("cursor-grabbing");
      return;
    }

    if (this.interaction.type === "select") {
      const shapes = this.entityManager.findShapesInRect({
        x: this.interaction.startWorldX,
        y: this.interaction.startWorldY,
        width: this.interaction.currentWorldX - this.interaction.startWorldX,
        height: this.interaction.currentWorldY - this.interaction.startWorldY,
      });
      this.selectShapes(shapes);
      this.interaction = {
        type: "idle",
        selectedIds: shapes.map((shape) => shape.id),
      };
      return;
    }

    if (this.interaction.type === "drag") {
      const finalShapes = this.dragController.end();
      finalShapes.forEach((shape) => {
        this.entityManager.updateShapeList(shape);
        this.onFinalUpdateCallback?.(shape);
      });
    }

    if (this.interaction.type === "resize") {
      const finalShape = this.resizeController.end();
      if (finalShape) {
        this.entityManager.updateShapeList(finalShape);
        this.onFinalUpdateCallback?.(finalShape);
      }
    }

    this.interaction = { type: "idle", selectedIds };
  }

  handlePanStart(screenX: number, screenY: number) {
    const selectedIds = this.interaction.selectedIds;
    this.interaction = {
      type: "pan",
      startX: screenX,
      startY: screenY,
      selectedIds,
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

  private selectShapes(shapes: _Shape[]) {
    this.entityManager.clearSelection();
    shapes.forEach((shape) => {
      shape.state = "dragging";
    });
  }

  private addCursorClass(className: string) {
    this.containerElement?.classList.add(className);
  }

  private removeCursorClass(className: string) {
    this.containerElement?.classList.remove(className);
  }
}
