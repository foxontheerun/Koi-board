import type { _Shape } from "../model/EntityManager";
import { ResizeHandles, type ResizeHandle } from "../model/types";

export class ResizeCalculator {
  static resize(
    shape: _Shape,
    handle: ResizeHandle,
    worldPoint: { x: number; y: number }
  ): _Shape {
    switch (shape.type) {
      case "RECT":
      default:
        return this.resizeSimpleShape(shape, handle, worldPoint);
    }
  }

  private static resizeSimpleShape(
    shape: _Shape,
    handle: ResizeHandle,
    worldPoint: { x: number; y: number }
  ): _Shape {
    let newShape = { ...shape };
    switch (handle) {
      case ResizeHandles.Right: {
        const newWidth = worldPoint.x - newShape.x;
        const newHeight = (newWidth / newShape.width) * newShape.height;

        newShape.width = Math.max(newWidth, 1);
        newShape.height = Math.max(newHeight, 1);
        break;
      }

      case ResizeHandles.Left: {
        const oldRight = newShape.x + newShape.width;
        const newWidth = oldRight - worldPoint.x;
        const newHeight = (newWidth / newShape.width) * newShape.height;

        newShape.x = worldPoint.x;
        newShape.width = Math.max(newWidth, 1);
        newShape.height = Math.max(newHeight, 1);
        break;
      }

      case ResizeHandles.Bottom: {
        const newHeight = worldPoint.y - newShape.y;
        const newWidth = (newHeight / newShape.height) * newShape.width;

        newShape.height = Math.max(newHeight, 1);
        newShape.width = Math.max(newWidth, 1);
        break;
      }

      case ResizeHandles.Top: {
        const oldBottom = newShape.y + newShape.height;
        const newHeight = oldBottom - worldPoint.y;
        const newWidth = (newHeight / newShape.height) * newShape.width;

        newShape.y = worldPoint.y;
        newShape.height = Math.max(newHeight, 1);
        newShape.width = Math.max(newWidth, 1);
        break;
      }

      case ResizeHandles.TopLeft: {
        const oldRight = newShape.x + newShape.width;
        const oldBottom = newShape.y + newShape.height;
        const newWidth = oldRight - worldPoint.x;
        const newHeight = oldBottom - worldPoint.y;

        newShape.x = worldPoint.x;
        newShape.y = worldPoint.y;
        newShape.width = Math.max(newWidth, 1);
        newShape.height = Math.max(newHeight, 1);
        break;
      }

      case ResizeHandles.TopRight: {
        const newWidth = worldPoint.x - newShape.x;
        const oldBottom = newShape.y + newShape.height;
        const newHeight = oldBottom - worldPoint.y;

        newShape.y = worldPoint.y;
        newShape.width = Math.max(newWidth, 1);
        newShape.height = Math.max(newHeight, 1);
        break;
      }

      case ResizeHandles.BottomLeft: {
        const oldRight = newShape.x + newShape.width;
        const newWidth = oldRight - worldPoint.x;
        const newHeight = worldPoint.y - newShape.y;

        newShape.x = worldPoint.x;
        newShape.width = Math.max(newWidth, 1);
        newShape.height = Math.max(newHeight, 1);
        break;
      }

      case ResizeHandles.BottomRight: {
        const newWidth = worldPoint.x - newShape.x;
        const newHeight = worldPoint.y - newShape.y;

        newShape.width = Math.max(newWidth, 1);
        newShape.height = Math.max(newHeight, 1);
        break;
      }
    }

    return newShape;
  }
}
