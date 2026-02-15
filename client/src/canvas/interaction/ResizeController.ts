import type { _Shape, ResizeHandle } from "../entities";
import { ResizeCalculator } from "./ResizeCalculator";

export class ResizeController {
  private shape: _Shape | null = null;
  private startPointer: { x: number; y: number } | null = null;
  private startShape: _Shape | null = null;
  private handle: ResizeHandle | null = null;

  begin(
    shape: _Shape,
    handle: ResizeHandle,
    pointer: { x: number; y: number },
  ) {
    this.shape = { ...shape, state: "dragging" };
    this.handle = handle;
    this.startPointer = { ...pointer };
    this.startShape = { ...shape, state: "dragging" };
  }

  update(pointer: { x: number; y: number }): _Shape | null {
    if (!this.shape || !this.startShape || !this.startPointer || !this.handle)
      return null;

    const deltaX = pointer.x - this.startPointer.x;
    const deltaY = pointer.y - this.startPointer.y;

    const next = ResizeCalculator.resize(this.startShape, this.handle, {
      x: deltaX,
      y: deltaY,
    });

    this.shape = { ...next, id: this.shape.id, state: "dragging" };

    return this.shape;
  }

  end(): _Shape | null {
    const finalShape = this.shape || null;

    this.shape = null;
    this.startPointer = null;
    this.startShape = null;
    this.handle = null;

    return finalShape;
  }
}
