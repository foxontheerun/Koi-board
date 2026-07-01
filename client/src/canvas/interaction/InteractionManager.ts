import type { EntityManager } from "../entities/EntityManager";
import type { DragController } from "./DragController";
import type { ResizeController } from "./ResizeController";
import { ResizeCalculator } from "./ResizeCalculator";
import { GroupResizeController } from "./GroupResizeController";
import {
  hitTestResizeHandle,
  RESIZE_HANDLE_SIZE,
} from "../rendering/layers/mouseEventHandlingHelpers";
import type { InteractionMode, Point } from "../types";
import type { _Shape } from "../entities";

// Movement past this many canvas pixels turns a click into a drag.
const DRAG_THRESHOLD = 3;

export class InteractionManager {
  private interaction: InteractionMode = { type: "idle", selectedIds: [] };
  private containerElement: HTMLElement | null = null;

  private onTransientUpdateCallback?: (shape: _Shape) => void;
  private onFinalUpdateCallback?: (shape: _Shape) => void;

  // A transient drag grabs an unselected shape: it moves but leaves no
  // selection behind unless the press turns out to be a click.
  private transientDrag = false;
  private dragMoved = false;
  private dragStart: Point | null = null;
  private selectAdditive = false;
  private groupResize = new GroupResizeController();

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

  handleMouseDown(
    worldPoint: Point,
    canvasPoint: Point,
    scale: number,
    shiftKey: boolean,
  ) {
    const selectedIds = this.getSelectedIds();

    if (!shiftKey && selectedIds.length > 1) {
      const groupShapes = this.entityManager
        .getShapes()
        .filter((s) => selectedIds.includes(s.id) && !s.locked);
      const groupBounds = ResizeCalculator.getGroupBounds(groupShapes);
      const handle = hitTestResizeHandle(groupBounds, worldPoint, scale);
      if (handle) {
        this.groupResize.begin(groupShapes, handle, worldPoint);
        this.interaction = { type: "group-resize", selectedIds };
        return;
      }
    }

    if (!shiftKey) {
      const grabbed = this.findSelectedResizeHandle(worldPoint, scale);
      if (grabbed) {
        this.resizeController.begin(grabbed.shape, grabbed.handle, worldPoint);
        this.interaction = {
          type: "resize",
          selectedIds: [grabbed.shape.id],
          activeId: grabbed.shape.id,
        };
        return;
      }
    }

    const shape = this.entityManager.findShapeAt(
      worldPoint,
      RESIZE_HANDLE_SIZE / scale,
    );

    if (!shape) {
      this.selectAdditive = shiftKey;
      if (!shiftKey) this.entityManager.clearSelection();
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
        selectedIds: shiftKey ? this.getSelectedIds() : [],
      };
      return;
    }

    // Locked shapes can be selected (to unlock) but never moved or resized.
    if (shape.locked) {
      this.selectShapes([shape]);
      this.interaction = { type: "idle", selectedIds: [shape.id] };
      return;
    }

    const isSelected = selectedIds.includes(shape.id);

    if (shiftKey) {
      if (isSelected) {
        shape.state = "static";
        this.interaction = {
          type: "idle",
          selectedIds: selectedIds.filter((id) => id !== shape.id),
        };
      } else {
        shape.state = "selected";
        this.interaction = {
          type: "idle",
          selectedIds: [...selectedIds, shape.id],
        };
      }
      return;
    }

    this.dragStart = canvasPoint;
    this.dragMoved = false;

    if (isSelected) {
      const dragShapes = this.entityManager
        .getShapes()
        .filter((candidate) => selectedIds.includes(candidate.id))
        .filter((candidate) => !candidate.locked);
      this.dragController.begin(dragShapes, worldPoint);
      this.interaction = {
        type: "drag",
        selectedIds: dragShapes.map((s) => s.id),
        activeId: shape.id,
      };
      this.transientDrag = false;
    } else {
      // Grabbing an unselected shape drags it without committing a selection.
      this.entityManager.clearSelection();
      this.dragController.begin([shape], worldPoint);
      this.interaction = {
        type: "drag",
        selectedIds: [shape.id],
        activeId: shape.id,
      };
      this.transientDrag = true;
    }
  }

  private findSelectedResizeHandle(worldPoint: Point, scale: number) {
    for (const id of this.getSelectedIds()) {
      const shape = this.entityManager.getById(id);
      if (!shape || shape.locked) continue;
      const handle = hitTestResizeHandle(
        ResizeCalculator.getShapeManipulationBounds(shape),
        worldPoint,
        scale,
      );
      if (handle) return { shape, handle };
    }
    return null;
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
      if (this.dragStart && !this.dragMoved) {
        const dx = canvasPoint.x - this.dragStart.x;
        const dy = canvasPoint.y - this.dragStart.y;
        if (Math.hypot(dx, dy) > DRAG_THRESHOLD) this.dragMoved = true;
      }

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

    if (this.interaction.type === "group-resize") {
      const updated = this.groupResize.update(worldPoint);
      updated.forEach((shape) => {
        this.entityManager.updateShapeList(shape);
        this.onTransientUpdateCallback?.(shape);
      });
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
      const found = this.entityManager.findShapesInRect({
        x: this.interaction.startWorldX,
        y: this.interaction.startWorldY,
        width: this.interaction.currentWorldX - this.interaction.startWorldX,
        height: this.interaction.currentWorldY - this.interaction.startWorldY,
      });

      if (this.selectAdditive) {
        const merged = [...this.interaction.selectedIds];
        found.forEach((shape) => {
          if (!merged.includes(shape.id)) merged.push(shape.id);
        });
        this.selectShapes(found, true);
        this.interaction = { type: "idle", selectedIds: merged };
      } else {
        this.selectShapes(found);
        this.interaction = {
          type: "idle",
          selectedIds: found.map((shape) => shape.id),
        };
      }

      this.selectAdditive = false;
      return;
    }

    if (this.interaction.type === "drag") {
      const finalShapes = this.dragController.end();
      finalShapes.forEach((shape) => {
        this.entityManager.updateShapeList(shape);
        this.onFinalUpdateCallback?.(shape);
      });

      if (this.transientDrag) {
        if (this.dragMoved) {
          // Moved an unselected shape — leave nothing selected.
          this.entityManager.clearSelection();
          this.interaction = { type: "idle", selectedIds: [] };
        } else {
          // It was a click, not a drag — select the shape.
          this.selectShapes(finalShapes);
          this.interaction = {
            type: "idle",
            selectedIds: finalShapes.map((shape) => shape.id),
          };
        }
        return;
      }
    }

    if (this.interaction.type === "resize") {
      const finalShape = this.resizeController.end();
      if (finalShape) {
        this.entityManager.updateShapeList(finalShape);
        this.onFinalUpdateCallback?.(finalShape);
      }
    }

    if (this.interaction.type === "group-resize") {
      const finalShapes = this.groupResize.end();
      finalShapes.forEach((shape) => {
        this.entityManager.updateShapeList(shape);
        this.onFinalUpdateCallback?.(shape);
      });
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

  selectById(id: string) {
    const shape = this.entityManager.getById(id);
    this.selectShapes(shape ? [shape] : []);
    this.interaction = { type: "idle", selectedIds: shape ? [id] : [] };
  }

  private selectShapes(shapes: _Shape[], additive = false) {
    if (!additive) this.entityManager.clearSelection();
    shapes.forEach((shape) => {
      shape.state = "selected";
    });
  }

  private addCursorClass(className: string) {
    this.containerElement?.classList.add(className);
  }

  private removeCursorClass(className: string) {
    this.containerElement?.classList.remove(className);
  }
}
