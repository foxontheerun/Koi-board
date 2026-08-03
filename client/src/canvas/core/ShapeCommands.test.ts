import { describe, it, expect, vi } from "vitest";
import { ShapeCommands } from "./ShapeCommands";
import type { EntityManager, _Shape } from "../entities";
import type { InteractionManager } from "../interaction/InteractionManager";
import type { RenderOrchestrator } from "../rendering/RenderOrchestrator";
import { DEFAULT_FONT_WEIGHT, TEXT_COLOR } from "../entities/shapes/text";

const textShape = (): _Shape => ({
  id: "t1",
  x: 0,
  y: 0,
  width: 200,
  height: 44,
  fill: "transparent",
  stroke: "transparent",
  state: "static",
  type: "TEXT",
  fontSize: 20,
  text: "hello",
});

function setup(shape: _Shape) {
  const callbacks = {
    onPersist: vi.fn(),
    onLiveEdit: vi.fn(),
    onDelete: vi.fn(),
    onSelectionChange: vi.fn(),
  };

  const entityManager = {
    getById: (id: string) => (id === shape.id ? shape : null),
    removeShapes: (ids: string[]) => ids,
  } as unknown as EntityManager;

  const render = {
    all: vi.fn(),
    staticLayer: vi.fn(),
    overlay: vi.fn(),
  } as unknown as RenderOrchestrator;

  const interaction = {
    selectById: vi.fn(),
    getSelectedIds: () => [],
  } as unknown as InteractionManager;

  return {
    commands: new ShapeCommands(entityManager, render, interaction, callbacks),
    callbacks,
    shape,
  };
}

describe("ShapeCommands text editing", () => {
  it("streams a preview without persisting it", () => {
    const { commands, callbacks, shape } = setup(textShape());

    commands.previewShapeText("t1", "hello there");

    expect(callbacks.onLiveEdit).toHaveBeenCalledTimes(1);
    expect(callbacks.onPersist).not.toHaveBeenCalled();
    expect(shape.text).toBe("hello there");
  });

  it("persists on commit", () => {
    const { commands, callbacks } = setup(textShape());

    commands.commitShapeText("t1", "final");

    expect(callbacks.onPersist).toHaveBeenCalledTimes(1);
    expect(callbacks.onDelete).not.toHaveBeenCalled();
  });

  it("removes a text block committed empty", () => {
    const { commands, callbacks } = setup(textShape());

    commands.commitShapeText("t1", "   ");

    expect(callbacks.onDelete).toHaveBeenCalledWith("t1");
    expect(callbacks.onPersist).not.toHaveBeenCalled();
  });

  it("keeps an emptied sticker, since the shape is more than its text", () => {
    const { commands, callbacks } = setup({
      ...textShape(),
      type: "STICKER",
    });

    commands.commitShapeText("t1", "");

    expect(callbacks.onDelete).not.toHaveBeenCalled();
    expect(callbacks.onPersist).toHaveBeenCalledTimes(1);
  });

  it("grows a block that still matches its text", () => {
    const { commands, shape } = setup(textShape());
    const before = shape.height;

    commands.previewShapeText("t1", "one two three four five six seven eight");

    expect(shape.height).toBeGreaterThan(before);
  });

  it("applies a style patch and persists it", () => {
    const { commands, callbacks, shape } = setup(textShape());

    commands.setTextStyle(["t1"], { fontWeight: 700, textAlign: "CENTER" });

    expect(shape.fontWeight).toBe(700);
    expect(shape.textAlign).toBe("CENTER");
    expect(callbacks.onPersist).toHaveBeenCalledTimes(1);
  });

  it("applies italic across the whole text when nothing is selected", () => {
    const { commands, shape } = setup(textShape());

    commands.setTextStyle(["t1"], { italic: true });

    expect(shape.textFormats).toContain('"italic":true');
  });

  it("keeps italic out of the shape's block style, which has no such field", () => {
    const { commands, shape } = setup(textShape());

    commands.setTextStyle(["t1"], { italic: true, fontSize: 24 });

    expect(shape.fontSize).toBe(24);
    expect("italic" in shape).toBe(false);
  });

  it("re-fits the block when the font size changes", () => {
    const { commands, shape } = setup(textShape());
    const before = shape.height;

    commands.setTextStyle(["t1"], { fontSize: 48 });

    expect(shape.height).toBeGreaterThan(before);
  });

  it("reports the style of the selection, falling back to defaults", () => {
    const { commands } = setup({ ...textShape(), fontWeight: undefined });

    expect(commands.textStyleOf(["t1"])).toEqual({
      fontSize: 20,
      fontWeight: DEFAULT_FONT_WEIGHT,
      textAlign: "LEFT",
      textColor: TEXT_COLOR,
    });
  });

  it("has no style to report for shapes that hold no text", () => {
    const { commands } = setup({ ...textShape(), type: "RECT" });

    expect(commands.textStyleOf(["t1"])).toBeNull();
  });

  it("offers no text styling on an empty sticker", () => {
    const { commands } = setup({ ...textShape(), type: "STICKER", text: "" });

    expect(commands.textStyleOf(["t1"])).toBeNull();
  });

  it("offers it once the sticker carries text", () => {
    const { commands } = setup({ ...textShape(), type: "STICKER" });

    expect(commands.textStyleOf(["t1"])).not.toBeNull();
  });

  it("offers it on an empty text block, which is only ever text", () => {
    const { commands } = setup({ ...textShape(), text: "" });

    expect(commands.textStyleOf(["t1"])).not.toBeNull();
  });

  it("keeps slack given by hand", () => {
    const { commands, shape } = setup({ ...textShape(), height: 400 });

    commands.previewShapeText("t1", "hi");

    expect(shape.height).toBe(400);
  });
});
