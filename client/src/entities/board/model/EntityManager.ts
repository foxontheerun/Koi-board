import type { ShapeType } from "../../block";

// import type { Shape } from "../../block";
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
      fill: "#c0ff96b9",
      stroke: "#9deb55ff",
      state: "static",
      radius: 8,
      type: "RECT",
    },
    {
      id: "2",
      x: 300,
      y: 200,
      width: 150,
      height: 100,
      fill: "#ff00d498",
      stroke: "#ff00d4ff",
      state: "static",
      radius: 8,
      type: "RECT",
    },
    {
      id: "2",
      x: 600,
      y: 400,
      width: 250,
      height: 100,
      fill: "#7cffee65",
      stroke: "#78e4d5ff",
      state: "static",
      radius: 8,
      type: "ELLIPSE",
    },
  ];

  getShapes() {
    return this.shapes;
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
