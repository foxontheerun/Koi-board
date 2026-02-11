import type { ShapeType } from "../../block";
import { ResizeCalculator } from "../lib/ResizeCalculator";

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

export class EntityManager {
  private shapes: _Shape[] = SHAPES;

  getShapes() {
    return [...this.shapes].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
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

  updateShapeList(newShape: _Shape) {
    const shapes = [...this.shapes];
    const currShapeInd = shapes.findIndex((shape) => shape.id === newShape.id);
    if (currShapeInd === -1) {
      shapes.push(newShape);
      return;
    }
    shapes[currShapeInd] = newShape;
    this.shapes = shapes;
  }

  findShapeAt(worldPoint: { x: number; y: number }, margin = 0): _Shape | null {
    const shapes = this.getShapes();
    for (let i = shapes.length - 1; i >= 0; i--) {
      const s = ResizeCalculator.getShapeManipulationBounds(shapes[i]);

      if (
        worldPoint.x >= s.x - margin &&
        worldPoint.x <= s.x + s.w + margin &&
        worldPoint.y >= s.y - margin &&
        worldPoint.y <= s.y + s.h + margin
      ) {
        return shapes[i];
      }
    }
    return null;
  }
}
