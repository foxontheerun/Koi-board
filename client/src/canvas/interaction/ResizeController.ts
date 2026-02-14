import type { _Shape } from "../model/shape.model";
import type { ResizeHandle } from "../model/types";
import { ResizeCalculator } from "./ResizeCalculator";

export class ResizeController {
  private shape: _Shape | null = null;
  private startPointer: { x: number; y: number } | null = null;
  private startShape: {
    x: number;
    y: number;
    width: number;
    height: number;
    id: string;
    state: "dragging";
  } | null = null;
  private handle: ResizeHandle | null = null;

  begin(
    shape: _Shape,
    handle: ResizeHandle,
    pointer: { x: number; y: number },
  ) {
    this.shape = shape;
    this.shape.state = "dragging";
    this.handle = handle;
    this.startPointer = { ...pointer };
    this.startShape = {
      ...shape,
      state: "dragging",
    };
  }

  update(pointer: { x: number; y: number }): _Shape | null {
    if (!this.shape || !this.startShape || !this.startPointer || !this.handle)
      return null;

    const deltaX = pointer.x - this.startPointer.x;
    const deltaY = pointer.y - this.startPointer.y;

    const newShape = ResizeCalculator.resize(
      this.startShape as _Shape,
      this.handle,
      { x: deltaX, y: deltaY },
    );

    return { ...newShape };
  }

  end(): _Shape | null {
    const finalShape = this.shape;
    this.shape = null;
    this.startPointer = null;
    this.startShape = null;
    this.handle = null;

    return finalShape;
  }
}
