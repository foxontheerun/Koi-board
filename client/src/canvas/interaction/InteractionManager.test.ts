import { describe, it, expect } from "vitest";
import { InteractionManager } from "./InteractionManager";
import { DragController } from "./DragController";
import { ResizeController } from "./ResizeController";
import { EntityManager } from "../entities/EntityManager";
import type { _Shape } from "../entities";

const shape = (over: Partial<_Shape> & { id: string }): _Shape => ({
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  fill: "#ffffff",
  stroke: "#000000",
  state: "static",
  type: "RECT",
  ...over,
});

function setup(shapes: _Shape[]) {
  const em = new EntityManager();
  shapes.forEach((s) => em.addShape(s));
  const im = new InteractionManager(
    em,
    new DragController(),
    new ResizeController(),
  );
  return { em, im };
}

describe("InteractionManager — resize handle priority", () => {
  it("resizes a selected shape via its handle even when another shape covers it", () => {
    const a = shape({ id: "a", x: 0, y: 0, width: 100, height: 100, zIndex: 0 });
    const b = shape({ id: "b", x: -30, y: -30, width: 60, height: 60, zIndex: 1 });
    const { im } = setup([a, b]);

    im.selectById("a");
    im.handleMouseDown({ x: 0, y: 0 }, { x: 0, y: 0 }, 1);

    const interaction = im.getInteraction();
    expect(interaction.type).toBe("resize");
    if (interaction.type === "resize") {
      expect(interaction.activeId).toBe("a");
    }
  });

  it("does not resize via a handle of an unselected shape", () => {
    const a = shape({ id: "a", x: 0, y: 0, width: 100, height: 100 });
    const { im } = setup([a]);

    im.handleMouseDown({ x: 0, y: 0 }, { x: 0, y: 0 }, 1);

    expect(im.getInteraction().type).not.toBe("resize");
  });
});
