import { test, expect, type Page } from "@playwright/test";

function waitForFrame(page: Page, needle: string): Promise<void> {
  return new Promise((resolve) => {
    page.on("websocket", (ws) => {
      ws.on("framereceived", (frame) => {
        const data = typeof frame.payload === "string" ? frame.payload : "";
        if (data.includes(needle)) resolve();
      });
    });
  });
}

async function openBoard(page: Page, boardId: string) {
  await page.goto(`/${boardId}`);
  await expect(page.getByText("Realtime Board")).toBeVisible();
}

async function drawRectangle(
  page: Page,
  from: [number, number],
  to: [number, number],
) {
  await page.getByTitle("Rectangle").click();
  await expect(page.getByText("Fill color")).toBeVisible();
  await page.mouse.move(from[0], from[1]);
  await page.mouse.down();
  await page.mouse.move(to[0], to[1], { steps: 8 });
  await page.mouse.up();
  // Creation resets the tool to pointer, which hides the colour picker.
  await expect(page.getByText("Fill color")).toBeHidden();
}

test("a shape drawn in one client is broadcast to another", async ({
  browser,
}) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  const pageA = await a.newPage();
  const pageB = await b.newPage();

  const shapeEventOnB = waitForFrame(pageB, "shapeEvents");

  await openBoard(pageA, "e2e-create");
  await openBoard(pageB, "e2e-create");

  await drawRectangle(pageA, [520, 300], [660, 420]);

  await shapeEventOnB;

  await a.close();
  await b.close();
});

test("dragging a shape broadcasts a lock and its movement", async ({
  browser,
}) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  const pageA = await a.newPage();
  const pageB = await b.newPage();

  const lockOnB = waitForFrame(pageB, "shapeLocks");
  const movedOnB = waitForFrame(pageB, "shapesMoved");

  await openBoard(pageA, "e2e-drag");
  await openBoard(pageB, "e2e-drag");

  await drawRectangle(pageA, [300, 300], [440, 420]);

  // Grab the shape near its centre and drag it.
  await pageA.mouse.move(370, 360);
  await pageA.mouse.down();
  await pageA.mouse.move(520, 360, { steps: 10 });
  await pageA.mouse.up();

  await lockOnB;
  await movedOnB;

  await a.close();
  await b.close();
});
