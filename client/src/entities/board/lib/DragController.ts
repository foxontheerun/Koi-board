type Pointer = {
  width: number;
  height: number;
  x: number;
  y: number;
};

export class DragController {
  start(shapeId: string, pointer: Pointer) {}
  update(pointer: Pointer) {}
  end() {}
}
