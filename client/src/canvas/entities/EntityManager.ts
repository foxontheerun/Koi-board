import type { ShapeType } from "../../entities/Shape";
import { ResizeCalculator } from "../interaction";

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
export interface _Shape {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth?: string;
  radius?: number;
  type?: ShapeType;
  state: "static" | "dragging";
  zIndex?: number;
}

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
    };
  }

  getShapes() {
    return this.shapes.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  }

  getDraggedShape() {
    return this.shapes.find((s) => s.state === "dragging");
  }

  getShapesOnDragLayer(): _Shape[] {
    const dragging = this.getDraggedShape();
    if (!dragging) return [];
    return this.getShapes().filter(
      (s) => (s.zIndex ?? 0) >= (dragging.zIndex ?? 0),
    );
  }

  clearSelection() {
    this.shapes.forEach((s) => (s.state = "static"));
  }

  updateShapeList(newShape: _Shape) {
    const shapes = this.shapes;
    const currShapeInd = shapes.findIndex((shape) => shape.id === newShape.id);
    if (currShapeInd === -1) {
      shapes.push(newShape);
      return;
    }
    shapes[currShapeInd] = newShape;
  }

  replaceAll(shapes: RemoteShape[]) {
    this.shapes = shapes.map((shape) => this.mapRemoteShapeToCanvas(shape));
  }

  applyTransientPatch(patch: TransientShapePatch) {
    const shape = this.shapes.find((s) => s.id === patch.id);
    if (!shape) return;

    if (patch.x !== undefined) shape.x = patch.x;
    if (patch.y !== undefined) shape.y = patch.y;
    if (patch.width !== undefined) shape.width = patch.width;
    if (patch.height !== undefined) shape.height = patch.height;
  }

  applyShapeEvent(event: ShapeEventPayload) {
    const { shape, type } = event;

    if (type === "DELETED") {
      const index = this.shapes.findIndex((s) => s.id === shape.id);
      if (index !== -1) {
        this.shapes.splice(index, 1);
      }
      return;
    }

    const nextShape = this.mapRemoteShapeToCanvas(shape);
    const existing = this.shapes.find((s) => s.id === shape.id);

    if (!existing) {
      this.shapes.push(nextShape);
      return;
    }

    Object.assign(existing, nextShape);
  }

  getById(id: string) {
    return this.shapes.find((s) => s.id === id) ?? null;
  }

  updateById(id: string, patch: Partial<_Shape>) {
    const s = this.getById(id);
    if (!s) return;
    Object.assign(s, patch);
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
}
