import type { _Shape, EntityManager } from "../entities";
import type { InteractionManager } from "../interaction/InteractionManager";
import type { RenderOrchestrator } from "../rendering/RenderOrchestrator";
import {
  DEFAULT_FONT_SIZE,
  DEFAULT_FONT_WEIGHT,
  STICKER_TEXT_COLOR,
  TEXT_COLOR,
  parseFormats,
  serializeFormats,
  type TextFormat,
  textBlockHeight,
} from "../entities/shapes/text";
import type { TextAlign } from "../../entities/Shape";

export interface TextStyle {
  fontSize: number;
  fontWeight: number;
  textAlign: TextAlign;
  textColor: string;
}

export type TextStylePatch = Partial<TextStyle>;

interface ShapeCommandCallbacks {
  onPersist: (shape: _Shape) => void;
  onLiveEdit: (shape: _Shape) => void;
  onDelete: (id: string) => void;
  onSelectionChange: (ids: string[]) => void;
}

export class ShapeCommands {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly render: RenderOrchestrator,
    private readonly interactionManager: InteractionManager,
    private readonly callbacks: ShapeCommandCallbacks,
  ) {}

  toggleLock(ids: string[]) {
    const changed = this.entityManager.setLocked(ids, !this.areAllLocked(ids));
    if (changed.length === 0) return;
    this.render.all();
    changed.forEach((shape) => this.callbacks.onPersist(shape));
    this.notifySelection();
  }

  bringToFront(ids: string[]) {
    this.applyZOrder(this.entityManager.bringToFront(this.unlockedIds(ids)));
  }

  sendToBack(ids: string[]) {
    this.applyZOrder(this.entityManager.sendToBack(this.unlockedIds(ids)));
  }

  moveForward(ids: string[]) {
    this.applyZOrder(this.entityManager.moveForward(this.unlockedIds(ids)));
  }

  moveBackward(ids: string[]) {
    this.applyZOrder(this.entityManager.moveBackward(this.unlockedIds(ids)));
  }

  deleteShapes(ids: string[]) {
    const removed = this.entityManager.removeShapes(this.unlockedIds(ids));
    if (removed.length === 0) return;
    this.interactionManager.selectById("");
    this.render.all();
    removed.forEach((id) => this.callbacks.onDelete(id));
    this.notifySelection();
  }

  previewShapeText(id: string, text: string, formats?: TextFormat[]) {
    const shape = this.applyText(id, text, formats);
    if (shape) this.callbacks.onLiveEdit(shape);
  }

  commitShapeText(id: string, text: string, formats?: TextFormat[]) {
    const shape = this.entityManager.getById(id);
    if (!shape) return;

    if (shape.type === "TEXT" && text.trim() === "") {
      this.deleteShapes([id]);
      return;
    }

    const updated = this.applyText(id, text, formats);
    if (updated) this.callbacks.onPersist(updated);
  }

  private applyText(
    id: string,
    text: string,
    formats?: TextFormat[],
  ): _Shape | null {
    const shape = this.entityManager.getById(id);
    if (!shape) return null;

    if (formats) shape.textFormats = serializeFormats(formats) ?? undefined;

    if (shape.type === "TEXT") {
      shape.height = this.refitHeight(shape, text);
    }

    shape.text = text;

    this.render.staticLayer();
    this.render.overlay();

    return shape;
  }

  // Slack added by hand survives; a block still sized to its text keeps
  // following it.
  private refitHeight(shape: _Shape, text = shape.text ?? ""): number {
    const formats = parseFormats(shape.textFormats);
    const before = textBlockHeight(
      shape.text ?? "",
      shape.width,
      shape.fontSize,
      shape.fontWeight,
      formats,
    );
    const after = textBlockHeight(
      text,
      shape.width,
      shape.fontSize,
      shape.fontWeight,
      formats,
    );

    return Math.abs(shape.height - before) < 1
      ? after
      : Math.max(after, shape.height);
  }

  setTextStyle(ids: string[], patch: TextStylePatch) {
    const changed = this.unlockedIds(ids)
      .map((id) => this.entityManager.getById(id))
      .filter((shape): shape is _Shape => shape !== null);

    if (changed.length === 0) return;

    changed.forEach((shape) => {
      Object.assign(shape, patch);
      if (shape.type === "TEXT") {
        // The block was measured with the old style; re-fit it to the new one.
        shape.height = textBlockHeight(
          shape.text ?? "",
          shape.width,
          shape.fontSize,
          shape.fontWeight,
          parseFormats(shape.textFormats),
        );
      }
    });

    this.render.all();
    changed.forEach((shape) => this.callbacks.onPersist(shape));
  }

  // A shape offers text styling when it is a text block, or when it is a
  // sticker that actually carries text - an empty one is a shape, and styling
  // controls on it are noise.
  textStyleOf(ids: string[]): TextStyle | null {
    const shape = ids
      .map((id) => this.entityManager.getById(id))
      .find(
        (s) =>
          s?.type === "TEXT" || (s?.type === "STICKER" && Boolean(s.text)),
      );

    if (!shape) return null;

    return {
      fontSize: shape.fontSize ?? DEFAULT_FONT_SIZE,
      fontWeight: shape.fontWeight ?? DEFAULT_FONT_WEIGHT,
      textAlign: shape.textAlign ?? "LEFT",
      textColor:
        shape.textColor ??
        (shape.type === "TEXT" ? TEXT_COLOR : STICKER_TEXT_COLOR),
    };
  }

  areAllLocked(ids: string[]): boolean {
    if (ids.length === 0) return false;
    return ids.every((id) => this.entityManager.getById(id)?.locked === true);
  }

  private unlockedIds(ids: string[]): string[] {
    return ids.filter((id) => this.entityManager.getById(id)?.locked !== true);
  }

  private applyZOrder(changed: _Shape[]) {
    if (changed.length === 0) return;
    this.render.all();
    changed.forEach((shape) => this.callbacks.onPersist(shape));
  }

  private notifySelection() {
    this.callbacks.onSelectionChange(this.interactionManager.getSelectedIds());
  }
}
