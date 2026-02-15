import type { _Shape } from "../entities";

export class DragController {
  private shapes: _Shape[] = [];
  private offsets = new Map<string, { x: number; y: number }>();

  begin(shapes: _Shape[], startPoint: { x: number; y: number }) {
    this.shapes.forEach((shape) => {
      shape.state = "static";
    });

    this.shapes = shapes;
    this.offsets.clear();

    this.shapes.forEach((shape) => {
      this.offsets.set(shape.id, {
        x: startPoint.x - shape.x,
        y: startPoint.y - shape.y,
      });
      shape.state = "dragging";
    });
  }

  update(point: { x: number; y: number }) {
    if (this.shapes.length === 0) return [];

    this.shapes.forEach((shape) => {
      shape.state = "dragging";

      const offset = this.offsets.get(shape.id);
      if (!offset) return;
      shape.x = point.x - offset.x;
      shape.y = point.y - offset.y;
    });

    return this.shapes;
  }

  end() {
    const finalShapes = [...this.shapes];
    finalShapes.forEach((shape) => {
      shape.state = "static";
    });
    this.shapes = [];
    this.offsets.clear();
    return finalShapes;
  }

  isDragging() {
    return this.shapes.length > 0;
  }
}
