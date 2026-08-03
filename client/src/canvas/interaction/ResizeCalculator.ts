import { ResizeHandles, type ResizeHandle } from "../entities/shapes/types";
import type { _Shape, ManipulationBounds } from "../entities";
import {
  DEFAULT_FONT_SIZE,
  MIN_TEXT_WIDTH,
  clampFontSize,
  parseFormats,
  textBlockHeight,
} from "../entities/shapes/text";

const LEFT_HANDLES: ResizeHandle[] = [
  ResizeHandles.Left,
  ResizeHandles.TopLeft,
  ResizeHandles.BottomLeft,
];

const TOP_HANDLES: ResizeHandle[] = [
  ResizeHandles.Top,
  ResizeHandles.TopLeft,
  ResizeHandles.TopRight,
];

const CORNER_HANDLES: ResizeHandle[] = [
  ResizeHandles.TopLeft,
  ResizeHandles.TopRight,
  ResizeHandles.BottomLeft,
  ResizeHandles.BottomRight,
];

export class ResizeCalculator {
  static getShapeManipulationBounds(shape: _Shape): ManipulationBounds {
    switch (shape?.type) {
      default:
        return this.getRectBounds(shape);
    }
  }

  private static getRectBounds(shape: _Shape) {
    return {
      x: shape.x,
      y: shape.y,
      w: shape.width,
      h: shape.height,
    };
  }

  static getGroupBounds(shapes: _Shape[]): ManipulationBounds {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const shape of shapes) {
      const b = this.getShapeManipulationBounds(shape);
      minX = Math.min(minX, b.x, b.x + b.w);
      minY = Math.min(minY, b.y, b.y + b.h);
      maxX = Math.max(maxX, b.x, b.x + b.w);
      maxY = Math.max(maxY, b.y, b.y + b.h);
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  static resize(
    shape: _Shape,
    handle: ResizeHandle,
    worldPoint: { x: number; y: number },
  ): _Shape {
    switch (shape.type) {
      case "TEXT":
        return this.resizeTextShape(shape, handle, worldPoint);
      case "RECT":
      default:
        return this.resizeSimpleShape(shape, handle, worldPoint);
    }
  }

  // Width reflows the text, corners scale the font with the box, and height is
  // free above the text: a block can be given slack, never cropped.
  private static resizeTextShape(
    shape: _Shape,
    handle: ResizeHandle,
    delta: { x: number; y: number },
  ): _Shape {
    const text = shape.text ?? "";
    const startFontSize = shape.fontSize ?? DEFAULT_FONT_SIZE;
    const anchorRight = LEFT_HANDLES.includes(handle);
    const anchorBottom = TOP_HANDLES.includes(handle);
    const isCorner = CORNER_HANDLES.includes(handle);

    const widthChanges =
      handle !== ResizeHandles.Top && handle !== ResizeHandles.Bottom;

    const width = widthChanges
      ? Math.max(
          MIN_TEXT_WIDTH,
          anchorRight ? shape.width - delta.x : shape.width + delta.x,
        )
      : shape.width;

    const fontSize = isCorner
      ? clampFontSize((startFontSize * width) / shape.width)
      : startFontSize;

    const formats = parseFormats(shape.textFormats);
    const fitted = textBlockHeight(
      text,
      width,
      fontSize,
      shape.fontWeight,
      formats,
    );

    // A block whose height still matches its text is treated as following it;
    // once it has been given slack by hand, that slack is kept.
    const wasFitted =
      Math.abs(
        shape.height -
          textBlockHeight(
            text,
            shape.width,
            startFontSize,
            shape.fontWeight,
            formats,
          ),
      ) < 1;

    const dragged = anchorBottom
      ? shape.height - delta.y
      : shape.height + delta.y;

    // Corners and edges drag height directly; a side handle only reflows, so
    // there the height either follows the text or keeps the slack it was given.
    const height =
      isCorner || !widthChanges
        ? Math.max(fitted, dragged)
        : wasFitted
          ? fitted
          : Math.max(fitted, shape.height);

    return {
      ...shape,
      width,
      height,
      fontSize,
      x: anchorRight ? shape.x + shape.width - width : shape.x,
      y: anchorBottom ? shape.y + shape.height - height : shape.y,
    };
  }

  private static resizeSimpleShape(
    shape: _Shape,
    handle: ResizeHandle,
    worldPoint: { x: number; y: number },
  ): _Shape {
    const newShape = { ...shape };
    switch (handle) {
      case ResizeHandles.Right: {
        newShape.width = newShape.width + worldPoint.x;
        return newShape;
      }

      case ResizeHandles.Left: {
        newShape.x = newShape.x + worldPoint.x;
        newShape.width = newShape.width - worldPoint.x;
        return newShape;
      }

      case ResizeHandles.Bottom: {
        newShape.height = newShape.height + worldPoint.y;
        return newShape;
      }

      case ResizeHandles.Top: {
        newShape.y = newShape.y + worldPoint.y;
        newShape.height = newShape.height - worldPoint.y;
        return newShape;
      }

      case ResizeHandles.TopLeft: {
        newShape.y = newShape.y + worldPoint.y;
        newShape.height = newShape.height - worldPoint.y;
        newShape.x = newShape.x + worldPoint.x;
        newShape.width = newShape.width - worldPoint.x;
        return newShape;
      }

      case ResizeHandles.TopRight: {
        newShape.y = newShape.y + worldPoint.y;
        newShape.height = newShape.height - worldPoint.y;
        newShape.width = newShape.width + worldPoint.x;
        return newShape;
      }

      case ResizeHandles.BottomLeft: {
        newShape.height = newShape.height + worldPoint.y;
        newShape.x = newShape.x + worldPoint.x;
        newShape.width = newShape.width - worldPoint.x;
        return newShape;
      }

      case ResizeHandles.BottomRight: {
        newShape.height = newShape.height + worldPoint.y;
        newShape.width = newShape.width + worldPoint.x;
        return newShape;
      }
    }
  }
}
