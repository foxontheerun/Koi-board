import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { openBoard, drawShape } from "./helpers";

const cases = [
  { kind: "rectangle", file: "rectangle.png" },
  { kind: "ellipse", file: "ellipse.png" },
  { kind: "sticker", file: "sticker.png" },
] as const;

for (const { kind, file } of cases) {
  test(`a drawn ${kind} matches its snapshot`, async ({ page }) => {
    // Fresh random board so the in-memory server starts empty (deterministic pixels).
    await openBoard(page, `snapshot-${randomUUID()}`);
    await drawShape(page, kind, [400, 250], [560, 380]);

    // The static layer (2nd canvas) holds committed shapes.
    await expect(page.locator("canvas").nth(1)).toHaveScreenshot(file, {
      animations: "disabled",
    });
  });
}
