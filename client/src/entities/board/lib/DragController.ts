import type { _Shape } from "../model/shape.model";

export class DragController {
  private shape: _Shape | null = null;
  private offset = { x: 0, y: 0 };

  begin(shape: _Shape, startPoint: { x: number; y: number }) {
    if (this.shape) this.shape.state = "static";
    this.shape = shape;
    this.offset = {
      x: startPoint.x - shape.x,
      y: startPoint.y - shape.y,
    };
    shape.state = "dragging";
  }

  update(point: { x: number; y: number }) {
    if (!this.shape) return null;

    this.shape.x = point.x - this.offset.x;
    this.shape.y = point.y - this.offset.y;

    return this.shape;
  }

  end() {
    if (this.shape) this.shape.state = "static";
    this.shape = null;
  }

  isDragging() {
    return this.shape !== null;
  }
}
