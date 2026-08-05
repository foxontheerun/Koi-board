import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { APP_URL, ensureOutDir, readSession } from "./lib.mjs";

const LABEL = process.env.PERF_LABEL ?? "baseline";
const VIEWPORT = { width: 1440, height: 900 };

async function analyse(page) {
  return new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    .analyze();
}

function condense(results) {
  return {
    violations: results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      tags: v.tags.filter((t) => t.startsWith("wcag") || t === "best-practice"),
      nodes: v.nodes.length,
      targets: v.nodes.slice(0, 6).map((n) => n.target.join(" ")),
      sample: v.nodes[0]?.failureSummary ?? null,
    })),
    incomplete: results.incomplete.map((v) => ({
      id: v.id,
      nodes: v.nodes.length,
    })),
    passes: results.passes.length,
  };
}

async function openBoard(context, session) {
  const page = await context.newPage();
  await page.goto(`${APP_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    (token) => localStorage.setItem("koi:refreshToken", token),
    session.refreshToken,
  );
  await page.goto(`${APP_URL}/${session.boardId}`, { waitUntil: "networkidle" });
  try {
    await page.waitForSelector("canvas", { timeout: 15000 });
  } catch (err) {
    const body = await page.locator("body").innerText();
    throw new Error(
      `board never rendered — at ${page.url()} showing: ${body.slice(0, 200)}`,
      { cause: err },
    );
  }
  await page.waitForTimeout(2000);
  return page;
}

async function keyboardWalk(page, maxStops = 25) {
  const stops = [];
  for (let i = 0; i < maxStops; i++) {
    await page.keyboard.press("Tab");
    // The toolbar buttons carry transition-all, which animates outline-width
    // and outline-color too; reading straight away catches them mid-way.
    await page.waitForTimeout(300);
    const stop = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        text: (el.textContent ?? "").trim().slice(0, 30),
        title: el.getAttribute("title"),
        ariaLabel: el.getAttribute("aria-label"),
        outline: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`,
        boxShadow: style.boxShadow === "none" ? null : style.boxShadow,
        visible: rect.width > 0 && rect.height > 0,
      };
    });
    if (!stop) {
      stops.push({ tag: "body", note: "focus left the document" });
      break;
    }
    stops.push(stop);
  }
  return stops;
}

async function main() {
  const session = readSession();
  if (!session?.boardId) throw new Error("run `node perf/seed.mjs` first");

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT });
  const report = { label: LABEL, states: {}, keyboard: {} };

  try {
    const login = await context.newPage();
    await login.goto(`${APP_URL}/login`, { waitUntil: "networkidle" });
    report.states.login = condense(await analyse(login));
    report.keyboard.login = await keyboardWalk(login, 10);
    await login.close();

    const boards = await context.newPage();
    await boards.goto(`${APP_URL}/login`, { waitUntil: "domcontentloaded" });
    await boards.evaluate(
      (token) => localStorage.setItem("koi:refreshToken", token),
      session.refreshToken,
    );
    await boards.goto(`${APP_URL}/`, { waitUntil: "networkidle" });
    await boards.waitForTimeout(1500);
    report.states["boards-list"] = condense(await analyse(boards));
    await boards.close();

    const board = await openBoard(context, session);
    report.states["board-idle"] = condense(await analyse(board));
    report.keyboard.board = await keyboardWalk(board, 25);

    await board.getByTitle("Sticky note").click();
    await board.waitForTimeout(400);
    report.states["board-colour-picker"] = condense(await analyse(board));

    await board.getByTitle("Pointer").click();
    await board.mouse.click(700, 430);
    await board.waitForTimeout(600);
    report.states["board-selection-toolbar"] = condense(await analyse(board));

    report.canvas = await board.evaluate(() =>
      Array.from(document.querySelectorAll("canvas")).map((c) => ({
        tabIndex: c.tabIndex,
        role: c.getAttribute("role"),
        ariaLabel: c.getAttribute("aria-label"),
        hasFallbackContent: c.childNodes.length > 0,
      })),
    );

    report.liveRegions = await board.evaluate(
      () =>
        document.querySelectorAll("[aria-live],[role=status],[role=alert]")
          .length,
    );

    await board.close();
  } finally {
    await browser.close();
  }

  const dir = ensureOutDir("a11y");
  const file = resolve(dir, `${LABEL}.json`);
  writeFileSync(file, JSON.stringify(report, null, 2) + "\n");

  for (const [state, res] of Object.entries(report.states)) {
    console.log(
      `${state}: ${res.violations.length} violation types — ` +
        res.violations.map((v) => `${v.id}(${v.nodes})`).join(", "),
    );
  }
  console.log(`\nwrote ${file}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
