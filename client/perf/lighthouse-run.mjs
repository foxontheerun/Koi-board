import { rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as chromeLauncher from "chrome-launcher";
import lighthouse, { desktopConfig } from "lighthouse";
import { chromium } from "@playwright/test";
import { APP_URL, ensureOutDir, median, readSession, round } from "./lib.mjs";

const RUNS = Number(process.env.PERF_RUNS ?? 3);
const LABEL = process.env.PERF_LABEL ?? "baseline";

const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];

const METRICS = [
  ["performance", (lhr) => lhr.categories.performance.score * 100],
  ["accessibility", (lhr) => lhr.categories.accessibility.score * 100],
  ["best-practices", (lhr) => lhr.categories["best-practices"].score * 100],
  ["seo", (lhr) => lhr.categories.seo.score * 100],
  ["fcp", (lhr) => lhr.audits["first-contentful-paint"].numericValue],
  ["lcp", (lhr) => lhr.audits["largest-contentful-paint"].numericValue],
  ["tbt", (lhr) => lhr.audits["total-blocking-time"].numericValue],
  ["cls", (lhr) => lhr.audits["cumulative-layout-shift"].numericValue],
  ["speed-index", (lhr) => lhr.audits["speed-index"].numericValue],
  ["tti", (lhr) => lhr.audits["interactive"]?.numericValue ?? NaN],
  ["total-byte-weight", (lhr) => lhr.audits["total-byte-weight"].numericValue],
  [
    "script-bytes",
    (lhr) =>
      (lhr.audits["resource-summary"]?.details?.items ?? []).find(
        (i) => i.resourceType === "script",
      )?.transferSize ?? NaN,
  ],
  [
    "script-requests",
    (lhr) =>
      (lhr.audits["resource-summary"]?.details?.items ?? []).find(
        (i) => i.resourceType === "script",
      )?.requestCount ?? NaN,
  ],
];

// Lighthouse runs with disableStorageReset so the seeded refresh token survives
// into the measured navigation — but that also keeps the HTTP cache, so the
// cache this seeding step warms has to be dropped explicitly or the board is
// measured warm while the login page is measured cold.
async function seedSession(port, origin, refreshToken) {
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const context = browser.contexts()[0];
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(`${origin}/vite.svg`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ([token]) => localStorage.setItem("koi:refreshToken", token),
    [refreshToken],
  );
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.clearBrowserCache");
  await browser.close();
}

async function runOne(url, preset, port) {
  const flags = {
    port,
    output: ["json", "html"],
    onlyCategories: CATEGORIES,
    disableStorageReset: true,
    logLevel: "error",
  };
  const config = preset === "desktop" ? desktopConfig : undefined;
  const result = await lighthouse(url, flags, config);
  return result;
}

async function main() {
  const session = readSession();
  if (!session?.boardId) {
    throw new Error("run `node perf/seed.mjs` first");
  }

  const only = process.env.PERF_ONLY ? process.env.PERF_ONLY.split(",") : null;

  const targets = [
    { name: "login", url: `${APP_URL}/login` },
    { name: "board", url: `${APP_URL}/${session.boardId}` },
  ].filter((t) => !only || only.some((o) => o.startsWith(t.name)));

  const presets = ["mobile", "desktop"].filter(
    (p) => !only || only.some((o) => o.endsWith(p)),
  );

  const outDir = ensureOutDir(`lighthouse/${LABEL}`);
  const summary = {
    label: LABEL,
    shapeCount: session.shapeCount,
    boardId: session.boardId,
    runs: RUNS,
    results: {},
  };

  for (const target of targets) {
    for (const preset of presets) {
      const key = `${target.name}-${preset}`;
      const samples = [];

      for (let run = 1; run <= RUNS; run++) {
        const chrome = await chromeLauncher.launch({
          chromeFlags: ["--headless=new", "--no-first-run", "--no-default-browser-check"],
        });

        try {
          if (target.name === "board") {
            await seedSession(chrome.port, APP_URL, session.refreshToken);
          }
          const result = await runOne(target.url, preset, chrome.port);
          const lhr = result.lhr;

          if (lhr.runtimeError) {
            throw new Error(`${key} run ${run}: ${lhr.runtimeError.message}`);
          }

          const row = {};
          for (const [name, pick] of METRICS) row[name] = pick(lhr);
          samples.push(row);

          writeFileSync(resolve(outDir, `${key}-run${run}.json`), result.report[0]);
          writeFileSync(resolve(outDir, `${key}-run${run}.html`), result.report[1]);

          console.log(
            `${key} run ${run}: perf ${round(row.performance, 0)} a11y ${round(row.accessibility, 0)} ` +
              `LCP ${round(row.lcp)}ms TBT ${round(row.tbt)}ms CLS ${round(row.cls, 3)}`,
          );
        } finally {
          // chrome-launcher removes its temp profile straight after killing the
          // process; on Windows the handle is often still open for a moment.
          try {
            await chrome.kill();
          } catch (err) {
            if (err?.code !== "EPERM") throw err;
          }
        }
      }

      const medians = {};
      for (const [name] of METRICS) {
        medians[name] = round(median(samples.map((s) => s[name])), 3);
      }

      // Every run's raw JSON is kept — that is the artefact a number can be
      // checked against. The rendered HTML is 700 kB a piece and adds nothing
      // the JSON lacks, so only the median run keeps one.
      const medianRun =
        samples
          .map((s, i) => ({ lcp: s.lcp, run: i + 1 }))
          .sort((a, b) => a.lcp - b.lcp)[Math.floor(samples.length / 2)].run;

      for (let run = 1; run <= RUNS; run++) {
        if (run === medianRun) continue;
        rmSync(resolve(outDir, `${key}-run${run}.html`), { force: true });
      }

      summary.results[key] = { samples, median: medians, medianRun };
      console.log(`${key} MEDIAN:`, medians);
    }
  }

  writeFileSync(
    resolve(outDir, "summary.json"),
    JSON.stringify(summary, null, 2) + "\n",
  );
  console.log(`\nwrote ${resolve(outDir, "summary.json")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
