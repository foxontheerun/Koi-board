import type { ShapeType } from "../../entities/Shape";
import { ResizeCalculator } from "../interaction";
import type { _Shape } from "./shapes";

const SHAPES: _Shape[] = [
  {
    id: "1",
    x: 100,
    y: 100,
    width: 100,
    height: 100,
    fill: "#c0ff96ff",
    stroke: "#9deb55ff",
    state: "static",
    radius: 8,
    type: "RECT",
    zIndex: 0,
  },
  {
    id: "2",
    x: 300,
    y: 300,
    width: 300,
    height: 300,
    fill: "#ffa2efff",
    stroke: "#ff00d4ff",
    state: "static",
    radius: 8,
    type: "RECT",
    zIndex: 1,
  },
  {
    id: "3",
    x: 700,
    y: 400,
    width: 300,
    height: 300,
    fill: "#79d5ffff",
    stroke: "#26badfff",
    state: "static",
    type: "RECT",
    radius: 8,
    zIndex: 2,
  },
  {
    id: "4",
    x: 800,
    y: 100,
    width: 100,
    height: 100,
    fill: "#ffefa8",
    stroke: "#d1a037",
    state: "static",
    type: "RECT",
    zIndex: 3,
    radius: 8,
  },
  {
    id: "5",
    x: 100,
    y: 400,
    width: 100,
    height: 100,
    fill: "#7992ff",
    stroke: "#2638df",
    state: "static",
    radius: 8,
    type: "RECT",
    zIndex: 4,
  },
  {
    id: "6",
    x: 400,
    y: 100,
    width: 100,
    height: 100,
    fill: "#ffaf79",
    stroke: "#df6a26",
    state: "static",
    radius: 8,
    type: "RECT",
    zIndex: 5,
  },
];

export interface RemoteShape {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string | null;
  stroke?: string | null;
  strokeWidth?: number | null;
  type?: ShapeType;
  zIndex?: number | null;
  locked?: boolean | null;
}

export interface TransientShapePatch {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface ShapeEventPayload {
  type: "CREATED" | "UPDATED" | "DELETED";
  shape: RemoteShape;
}

export class EntityManager {
  private shapes: _Shape[] = SHAPES;
  private byId = new Map<string, _Shape>();
  // getShapes() re-sorts only when z-order may have changed, not on every call.
  private sortDirty = true;

  constructor() {
    this.reindex();
  }

  private reindex() {
    this.byId.clear();
    for (const s of this.shapes) this.byId.set(s.id, s);
    this.sortDirty = true;
  }

  private mapRemoteShapeToCanvas(shape: RemoteShape): _Shape {
    return {
      id: shape.id,
      x: shape.x,
      y: shape.y,
      width: shape.width,
      height: shape.height,
      fill: shape.fill ?? "#c5ff5b",
      stroke: shape.stroke ?? "#c5ff5b",
      strokeWidth: shape.strokeWidth ? String(shape.strokeWidth) : undefined,
      type: shape.type ?? "RECT",
      state: "static",
      radius: 8,
      zIndex: shape.zIndex ?? 0,
      locked: shape.locked ?? false,
    };
  }

  addShape(shape: _Shape) {
    this.shapes.push(shape);
    this.byId.set(shape.id, shape);
    this.sortDirty = true;
  }

  removeShape(id: string): boolean {
    const shape = this.byId.get(id);
    if (!shape) return false;

    const index = this.shapes.indexOf(shape);
    if (index !== -1) this.shapes.splice(index, 1);
    this.byId.delete(id);
    return true;
  }

  removeShapes(ids: string[]): string[] {
    const removed: string[] = [];
    for (const id of ids) {
      if (this.removeShape(id)) removed.push(id);
    }
    return removed;
  }

  setLocked(ids: string[], locked: boolean): _Shape[] {
    const changed: _Shape[] = [];
    for (const id of ids) {
      const shape = this.byId.get(id);
      if (shape && (shape.locked ?? false) !== locked) {
        shape.locked = locked;
        changed.push(shape);
      }
    }
    return changed;
  }

  getMaxZIndex(shapes = this.shapes): number {
    if (shapes.length === 0) return 0;
    return Math.max(...shapes.map((s) => s.zIndex ?? 0));
  }

  getMinZIndex(shapes = this.shapes): number {
    if (shapes.length === 0) return 0;
    return Math.min(...shapes.map((s) => s.zIndex ?? 0));
  }

  // Move the selection above every other shape, keeping its internal order.
  bringToFront(ids: string[]): _Shape[] {
    const selected = this.shapesByIds(ids);
    if (selected.length === 0) return [];
    selected.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

    let z = this.getMaxZIndex();
    const changed: _Shape[] = [];
    for (const shape of selected) {
      z += 1;
      if ((shape.zIndex ?? 0) !== z) {
        shape.zIndex = z;
        changed.push(shape);
      }
    }
    if (changed.length > 0) this.sortDirty = true;
    return changed;
  }

  // Move the selection below every other shape, keeping its internal order.
  sendToBack(ids: string[]): _Shape[] {
    const selected = this.shapesByIds(ids);
    if (selected.length === 0) return [];
    selected.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

    let z = this.getMinZIndex() - selected.length;
    const changed: _Shape[] = [];
    for (const shape of selected) {
      if ((shape.zIndex ?? 0) !== z) {
        shape.zIndex = z;
        changed.push(shape);
      }
      z += 1;
    }
    if (changed.length > 0) this.sortDirty = true;
    return changed;
  }

  moveForward(ids: string[]): _Shape[] {
    return this.shiftLayer(ids, "up");
  }

  moveBackward(ids: string[]): _Shape[] {
    return this.shiftLayer(ids, "down");
  }

  // Reorder the stack so the selection moves one layer up/down, stepping over
  // the nearest non-selected neighbour and never reordering within the group.
  private shiftLayer(ids: string[], dir: "up" | "down"): _Shape[] {
    const idSet = new Set(ids);
    const ordered = this.getShapes().slice();
    const zValues = this.getShapes().map((s) => s.zIndex ?? 0);
    if (ordered.length === 0) return [];

    const isSelected = (shape: _Shape) => idSet.has(shape.id);

    if (dir === "up") {
      for (let i = ordered.length - 1; i >= 0; i--) {
        if (
          i + 1 < ordered.length &&
          isSelected(ordered[i]) &&
          !isSelected(ordered[i + 1])
        ) {
          [ordered[i], ordered[i + 1]] = [ordered[i + 1], ordered[i]];
        }
      }
    } else {
      for (let i = 0; i < ordered.length; i++) {
        if (i > 0 && isSelected(ordered[i]) && !isSelected(ordered[i - 1])) {
          [ordered[i], ordered[i - 1]] = [ordered[i - 1], ordered[i]];
        }
      }
    }

    const changed: _Shape[] = [];
    ordered.forEach((shape, i) => {
      if ((shape.zIndex ?? 0) !== zValues[i]) {
        shape.zIndex = zValues[i];
        changed.push(shape);
      }
    });
    if (changed.length > 0) this.sortDirty = true;
    return changed;
  }

  private shapesByIds(ids: string[]): _Shape[] {
    const result: _Shape[] = [];
    for (const id of ids) {
      const shape = this.byId.get(id);
      if (shape) result.push(shape);
    }
    return result;
  }

  getShapes() {
    if (this.sortDirty) {
      this.shapes.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
      this.sortDirty = false;
    }
    return this.shapes;
  }

  getDraggedShape() {
    return this.shapes.find((s) => s.state === "dragging");
  }

  getShapesOnDragLayer(): _Shape[] {
    const shapes = this.getShapes();
    const moving = shapes.filter(
      (s) => s.state === "dragging" || s.state === "remote-dragging",
    );
    if (moving.length === 0) return [];

    const minZ = Math.min(...moving.map((s) => s.zIndex ?? 0));
    return shapes.filter((s) => (s.zIndex ?? 0) >= minZ);
  }

  clearSelection() {
    this.shapes.forEach((s) => (s.state = "static"));
  }

  updateShapeList(newShape: _Shape) {
    const existing = this.byId.get(newShape.id);

    if (!existing) {
      this.shapes.push(newShape);
      this.byId.set(newShape.id, newShape);
      this.sortDirty = true;
      return;
    }

    // Drag passes back the same object it mutated — nothing to do.
    if (existing === newShape) return;

    const idx = this.shapes.indexOf(existing);
    if (idx !== -1) this.shapes[idx] = newShape;
    this.byId.set(newShape.id, newShape);
    if ((existing.zIndex ?? 0) !== (newShape.zIndex ?? 0)) this.sortDirty = true;
  }

  replaceAll(shapes: RemoteShape[]) {
    this.shapes = shapes.map((shape) => this.mapRemoteShapeToCanvas(shape));
    this.reindex();
  }

  applyTransientPatch(patch: TransientShapePatch): { becameRemote: boolean } {
    const shape = this.byId.get(patch.id);
    if (!shape) return { becameRemote: false };

    const wasRemote = shape.state === "remote-dragging";

    if (patch.x !== undefined) shape.x = patch.x;
    if (patch.y !== undefined) shape.y = patch.y;
    if (patch.width !== undefined) shape.width = patch.width;
    if (patch.height !== undefined) shape.height = patch.height;

    shape.state = "remote-dragging";

    return { becameRemote: !wasRemote };
  }

  applyShapeEvent(event: ShapeEventPayload) {
    const { shape, type } = event;

    if (type === "DELETED") {
      const existing = this.byId.get(shape.id);
      if (existing) {
        const index = this.shapes.indexOf(existing);
        if (index !== -1) this.shapes.splice(index, 1);
        this.byId.delete(shape.id);
      }
      return;
    }

    const nextShape = this.mapRemoteShapeToCanvas(shape); // state будет "static"
    const existing = this.byId.get(shape.id);

    if (!existing) {
      this.shapes.push(nextShape);
      this.byId.set(nextShape.id, nextShape);
      this.sortDirty = true;
      return;
    }

    Object.assign(existing, nextShape); // сбросит remote-dragging → static
    this.sortDirty = true;
  }

  getById(id: string) {
    return this.byId.get(id) ?? null;
  }

  updateById(id: string, patch: Partial<_Shape>) {
    const s = this.byId.get(id);
    if (!s) return;
    Object.assign(s, patch);
    if (patch.zIndex !== undefined) this.sortDirty = true;
  }

  findShapeAt(worldPoint: { x: number; y: number }, margin = 0): _Shape | null {
    const shapes = this.getShapes();

    for (let i = shapes.length - 1; i >= 0; i--) {
      const bounds = ResizeCalculator.getShapeManipulationBounds(shapes[i]);

      const normalizedBounds = {
        x: bounds.w < 0 ? bounds.x + bounds.w : bounds.x,
        y: bounds.h < 0 ? bounds.y + bounds.h : bounds.y,
        w: Math.abs(bounds.w),
        h: Math.abs(bounds.h),
      };

      if (
        worldPoint.x >= normalizedBounds.x - margin &&
        worldPoint.x <= normalizedBounds.x + normalizedBounds.w + margin &&
        worldPoint.y >= normalizedBounds.y - margin &&
        worldPoint.y <= normalizedBounds.y + normalizedBounds.h + margin
      ) {
        return shapes[i];
      }
    }

    return null;
  }

  findShapesInRect(rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) {
    const minX = Math.min(rect.x, rect.x + rect.width);
    const maxX = Math.max(rect.x, rect.x + rect.width);
    const minY = Math.min(rect.y, rect.y + rect.height);
    const maxY = Math.max(rect.y, rect.y + rect.height);

    return this.getShapes().filter((shape) => {
      const bounds = ResizeCalculator.getShapeManipulationBounds(shape);

      const shapeMinX = Math.min(bounds.x, bounds.x + bounds.w);
      const shapeMaxX = Math.max(bounds.x, bounds.x + bounds.w);
      const shapeMinY = Math.min(bounds.y, bounds.y + bounds.h);
      const shapeMaxY = Math.max(bounds.y, bounds.y + bounds.h);

      return !(
        shapeMaxX < minX ||
        shapeMinX > maxX ||
        shapeMaxY < minY ||
        shapeMinY > maxY
      );
    });
  }
}
