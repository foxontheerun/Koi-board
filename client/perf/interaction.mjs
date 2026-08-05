import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { ensureOutDir, median, percentile, readSession, round } from "./lib.mjs";

const APP_URL = process.env.PERF_PERF_APP_URL ?? "http://localhost:4174";
const TRIALS = Number(process.env.PERF_TRIALS ?? 5);
const LABEL = process.env.PERF_LABEL ?? "baseline";
const VIEWPORT = { width: 1440, height: 900 };

// A long diagonal drag that keeps the shape over dense parts of the board, so
// the dirty rect never gets to be trivially small.
const DRAG = {
  from: { x: 700, y: 430 },
  to: { x: 380, y: 700 },
  steps: 80,
};

async function bootBoard(browser, session, cpuThrottle) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);

  await page.goto(`${APP_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    (token) => localStorage.setItem("koi:refreshToken", token),
    session.refreshToken,
  );

  await page.goto(`${APP_URL}/${session.boardId}`, { waitUntil: "networkidle" });
  await page.waitForSelector("canvas");
  await page.waitForTimeout(2500);

  const canvases = await page.locator("canvas").count();
  if (canvases !== 4) throw new Error(`expected 4 canvases, saw ${canvases}`);

  if (cpuThrottle > 1) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpuThrottle });
  }

  return { context, page, cdp };
}

async function runDrag(page, { naive }) {
  await page.evaluate((flag) => {
    window.__koiPerf.naive = flag;
    window.__koiPerf.samples = [];
    window.__koiFrames = [];
    window.__koiSampling = true;
    let last = performance.now();
    const tick = (now) => {
      window.__koiFrames.push(now - last);
      last = now;
      if (window.__koiSampling) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, naive);

  // No mouse.up(): releasing is what persists the move, and a board that
  // drifts between trials is a board where trial N is not measuring what
  // trial 1 measured.
  await page.mouse.move(DRAG.from.x, DRAG.from.y);
  await page.mouse.down();
  await page.mouse.move(DRAG.to.x, DRAG.to.y, { steps: DRAG.steps });

  const result = await page.evaluate(() => {
    window.__koiSampling = false;
    return {
      samples: window.__koiPerf.samples.slice(),
      frames: window.__koiFrames.slice(),
    };
  });

  // The first few frames of the rAF loop cover the mousedown, before the drag
  // is under way; they say nothing about steady-state cost.
  result.frames = result.frames.slice(2);
  return result;
}

function summarise(samples) {
  return {
    count: samples.length,
    p50: round(percentile(samples, 50), 3),
    p95: round(percentile(samples, 95), 3),
    max: round(Math.max(...samples), 3),
    mean: round(samples.reduce((a, b) => a + b, 0) / samples.length, 3),
  };
}

async function measureArm(browser, session, { naive, cpuThrottle }) {
  const trials = [];

  for (let trial = 0; trial <= TRIALS; trial++) {
    const { context, page } = await bootBoard(browser, session, cpuThrottle);
    try {
      const result = await runDrag(page, { naive });

      if (result.samples.length < DRAG.steps / 2) {
        throw new Error(
          `drag recorded only ${result.samples.length} render samples — ` +
            `the pointer probably missed a shape`,
        );
      }

      // Trial 0 is a warm-up: first paint of a shape type, font loading and
      // JIT all land in it.
      if (trial === 0) continue;

      trials.push({
        render: summarise(result.samples),
        frame: summarise(result.frames),
      });
    } finally {
      await context.close();
    }
  }

  return {
    trials,
    render: {
      p50: round(median(trials.map((t) => t.render.p50)), 3),
      p95: round(median(trials.map((t) => t.render.p95)), 3),
      max: round(median(trials.map((t) => t.render.max)), 3),
      samplesPerTrial: median(trials.map((t) => t.render.count)),
    },
    frame: {
      p50: round(median(trials.map((t) => t.frame.p50)), 3),
      p95: round(median(trials.map((t) => t.frame.p95)), 3),
      max: round(median(trials.map((t) => t.frame.max)), 3),
    },
  };
}

async function main() {
  const session = readSession();
  if (!session?.boardId) throw new Error("run `node perf/seed.mjs` first");

  const browser = await chromium.launch();
  const out = {
    label: LABEL,
    shapeCount: session.shapeCount,
    boardId: session.boardId,
    viewport: VIEWPORT,
    drag: DRAG,
    trials: TRIALS,
    arms: {},
  };

  try {
    for (const cpuThrottle of [1, 4]) {
      for (const naive of [false, true]) {
        const key = `${naive ? "no-dirty-rect" : "dirty-rect"}-cpu${cpuThrottle}x`;
        const arm = await measureArm(browser, session, { naive, cpuThrottle });
        out.arms[key] = { naive, cpuThrottle, ...arm };
        console.log(
          `${key}: render p50 ${arm.render.p50}ms p95 ${arm.render.p95}ms | ` +
            `frame p50 ${arm.frame.p50}ms p95 ${arm.frame.p95}ms`,
        );
      }
    }
  } finally {
    await browser.close();
  }

  const dir = ensureOutDir("interaction");
  const file = resolve(dir, `${LABEL}.json`);
  writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
  console.log(`\nwrote ${file}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
