import { expect, type Page } from "@playwright/test";

export async function openBoard(page: Page, boardId: string) {
  await page.goto(`/${boardId}`);
  await expect(page.getByText("Realtime Board")).toBeVisible();
}

const TOOLS = {
  rectangle: { title: "Rectangle", picker: "Fill color" },
  ellipse: { title: "Ellipse", picker: "Fill color" },
  sticker: { title: "Sticky note", picker: "Sticker color" },
} as const;

export async function drawShape(
  page: Page,
  kind: keyof typeof TOOLS,
  from: [number, number],
  to: [number, number],
) {
  const { title, picker } = TOOLS[kind];
  await page.getByTitle(title).click();
  await expect(page.getByText(picker)).toBeVisible();
  await page.mouse.move(from[0], from[1]);
  await page.mouse.down();
  await page.mouse.move(to[0], to[1], { steps: 8 });
  await page.mouse.up();
  // Creation resets the tool to pointer, which hides the colour picker.
  await expect(page.getByText(picker)).toBeHidden();
}
