import type { _Shape, ResizeHandle } from "../entities";
import { ResizeCalculator } from "./ResizeCalculator";

export class ResizeController {
  private shapeId: string | null = null;
  private startPointer: { x: number; y: number } | null = null;
  private startShape: _Shape | null = null;
  private handle: ResizeHandle | null = null;
  private last: _Shape | null = null;

  // Ссылка на живой объект фигуры — нужна чтобы вернуть state
  // обратно в "static" при end(), даже если last уже пересоздан.
  private liveShape: _Shape | null = null;

  begin(
    shape: _Shape,
    handle: ResizeHandle,
    pointer: { x: number; y: number },
  ) {
    this.shapeId = shape.id;
    this.handle = handle;
    this.startPointer = { ...pointer };
    this.startShape = { ...shape };
    this.last = { ...shape };
    this.liveShape = shape;

    // Переводим фигуру в dragging — она уйдёт на dragCanvas
    // и будет перерисовываться каждый кадр как при drag.
    shape.state = "dragging";
  }

  update(pointer: { x: number; y: number }): _Shape | null {
    if (!this.shapeId || !this.startShape || !this.startPointer || !this.handle)
      return null;

    const dx = pointer.x - this.startPointer.x;
    const dy = pointer.y - this.startPointer.y;

    const next = ResizeCalculator.resize(this.startShape, this.handle, {
      x: dx,
      y: dy,
    });

    this.last = { ...next, id: this.shapeId, state: "dragging" };

    // Обновляем живой объект чтобы dragCanvas видел актуальную геометрию.
    if (this.liveShape) {
      Object.assign(this.liveShape, this.last);
    }

    return this.last;
  }

  end(): _Shape | null {
    // Возвращаем фигуру в static перед тем как вернуть финальное состояние.
    if (this.liveShape) {
      this.liveShape.state = "static";
    }

    const out = this.last ? { ...this.last, state: "static" as const } : null;

    this.shapeId = null;
    this.startPointer = null;
    this.startShape = null;
    this.handle = null;
    this.last = null;
    this.liveShape = null;

    return out;
  }
}
