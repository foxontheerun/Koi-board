import type { ShapeType } from "../../block";

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
}
export class EntityManager {
  private shapes: _Shape[] = [
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
    },
    {
      id: "2",
      x: 400,
      y: 400,
      width: 300,
      height: 300,
      fill: "#ffa2efff",
      stroke: "#ff00d4ff",
      state: "static",
      radius: 8,
      type: "RECT",
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
      radius: 8,
      type: "RECT",
    },
  ];

  getShapes() {
    return this.shapes;
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

  findShapeAt(worldPoint: { x: number; y: number }): _Shape | null {
    for (let i = this.shapes.length - 1; i >= 0; i--) {
      const s = this.shapes[i];

      if (
        worldPoint.x >= s.x &&
        worldPoint.x <= s.x + s.width &&
        worldPoint.y >= s.y &&
        worldPoint.y <= s.y + s.height
      ) {
        return s;
      }
    }
    return null;
  }
}
