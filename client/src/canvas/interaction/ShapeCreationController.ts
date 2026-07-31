import {
  STICKY_PRESETS,
  type ShapeType,
  type StickyColorId,
} from "../../entities/Shape";
import {
  DEFAULT_FONT_SIZE,
  DEFAULT_TEXT_WIDTH,
  textBlockHeight,
} from "../entities/shapes/text";
import type { EntityManager, _Shape } from "../entities";
import type { RenderOrchestrator } from "../rendering/RenderOrchestrator";
import type { Point } from "../types";

type Tool = {
  type: ShapeType | null;
  startPoint: Point | null;
  previewShape: _Shape | null;
};

const MIN_DRAG_SIZE = 10;
const DEFAULT_SHAPE_SIZE = 100;
const RECT_CORNER_RADIUS = 8;
const DEFAULT_SHAPE_COLOR = { fill: "#DBEAFE", stroke: "#93C5FD" };
const TEXT_SHAPE_COLOR = { fill: "transparent", stroke: "transparent" };

export class ShapeCreationController {
  private activeStickyColor: StickyColorId = "yellow";
  private activeShapeColor = { ...DEFAULT_SHAPE_COLOR };

  private tool: Tool = {
    type: null,
    startPoint: null,
    previewShape: null,
  };

  constructor(
    private readonly entityManager: EntityManager,
    private readonly render: RenderOrchestrator,
    private readonly onPersist: (shape: _Shape) => void,
  ) {}

  setTool(type: ShapeType | null) {
    this.tool.type = type;
    this.tool.startPoint = null;
    this.tool.previewShape = null;
  }

  setStickyColor(colorId: StickyColorId) {
    this.activeStickyColor = colorId;
  }

  setShapeColor(fill: string, stroke: string) {
    this.activeShapeColor = { fill, stroke };
  }

  hasTool() {
    return this.tool.type !== null;
  }

  isCreating() {
    return this.tool.startPoint !== null;
  }

  hasPreview() {
    return this.tool.previewShape !== null;
  }

  begin(worldPoint: Point) {
    this.tool.startPoint = worldPoint;

    const color = this.colorForTool();

    this.tool.previewShape = {
      id: crypto.randomUUID(),
      type: this.tool.type!,
      x: worldPoint.x,
      y: worldPoint.y,
      width: 0,
      height: 0,
      fill: color.fill,
      stroke: color.stroke,
      state: "static",
      radius: this.tool.type === "RECT" ? RECT_CORNER_RADIUS : 0,
      zIndex: this.entityManager.getMaxZIndex() + 1,
      fontSize: this.tool.type === "TEXT" ? DEFAULT_FONT_SIZE : undefined,
    };
  }

  private colorForTool() {
    if (this.tool.type === "TEXT") return TEXT_SHAPE_COLOR;
    if (this.tool.type === "STICKER") {
      return STICKY_PRESETS[this.activeStickyColor];
    }
    return this.activeShapeColor;
  }

  updatePreview(worldPoint: Point) {
    if (!this.tool.startPoint || !this.tool.previewShape) return;

    const start = this.tool.startPoint;
    const width = worldPoint.x - start.x;
    const height = worldPoint.y - start.y;

    this.tool.previewShape = {
      ...this.tool.previewShape,
      width: Math.abs(width),
      height: Math.abs(height),
      x: width < 0 ? worldPoint.x : start.x,
      y: height < 0 ? worldPoint.y : start.y,
    };

    this.render.preview(this.tool.previewShape);
  }

  finish() {
    if (!this.tool.previewShape) return;

    const shape = this.tool.previewShape;

    if (shape.type === "TEXT") {
      if (shape.width < MIN_DRAG_SIZE) shape.width = DEFAULT_TEXT_WIDTH;
      shape.height = textBlockHeight("", shape.width, shape.fontSize);
    } else if (shape.width < MIN_DRAG_SIZE || shape.height < MIN_DRAG_SIZE) {
      shape.width = Math.max(shape.width, DEFAULT_SHAPE_SIZE);
      shape.height = Math.max(shape.height, DEFAULT_SHAPE_SIZE);
    }

    this.entityManager.addShape(shape);
    this.onPersist(shape);

    this.tool.startPoint = null;
    this.tool.previewShape = null;
    this.tool.type = null;

    this.render.all();
  }
}
