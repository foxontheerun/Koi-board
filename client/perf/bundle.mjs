import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";
import { CLIENT_DIR, ensureOutDir, round } from "./lib.mjs";

// Attributes every byte of the bundle to the source module it came from, by
// walking the sourcemap. Same idea as source-map-explorer, but without adding
// a dependency for a number that is read once.
const DIST = resolve(CLIENT_DIR, process.env.PERF_DIST ?? "dist-map");
const LABEL = process.env.PERF_LABEL ?? "baseline";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function decodeVlq(segment) {
  const values = [];
  let shift = 0;
  let value = 0;
  for (const char of segment) {
    const digit = CHARS.indexOf(char);
    if (digit === -1) throw new Error(`bad base64 vlq char: ${char}`);
    const cont = digit & 32;
    value += (digit & 31) << shift;
    if (cont) {
      shift += 5;
    } else {
      const negative = value & 1;
      value >>= 1;
      values.push(negative ? (value === 0 ? -0x80000000 : -value) : value);
      value = 0;
      shift = 0;
    }
  }
  return values;
}

function lineOffsets(code) {
  const offsets = [0];
  for (let i = 0; i < code.length; i++) {
    if (code[i] === "\n") offsets.push(i + 1);
  }
  return offsets;
}

function attribute(code, map) {
  const offsets = lineOffsets(code);
  const bySource = new Map();

  let sourceIndex = 0;
  let sourceLine = 0;
  let sourceColumn = 0;

  const segments = [];

  map.mappings.split(";").forEach((lineData, generatedLine) => {
    let generatedColumn = 0;
    if (!lineData) return;
    for (const raw of lineData.split(",")) {
      if (!raw) continue;
      const fields = decodeVlq(raw);
      generatedColumn += fields[0];
      if (fields.length >= 4) {
        sourceIndex += fields[1];
        sourceLine += fields[2];
        sourceColumn += fields[3];
        segments.push({
          offset: offsets[generatedLine] + generatedColumn,
          source: map.sources[sourceIndex],
        });
      } else {
        segments.push({
          offset: offsets[generatedLine] + generatedColumn,
          source: null,
        });
      }
    }
  });

  segments.sort((a, b) => a.offset - b.offset);

  for (let i = 0; i < segments.length; i++) {
    const start = segments[i].offset;
    const end = i + 1 < segments.length ? segments[i + 1].offset : code.length;
    const size = Math.max(0, end - start);
    const key = segments[i].source ?? "(unmapped)";
    bySource.set(key, (bySource.get(key) ?? 0) + size);
  }

  const mapped = [...bySource.values()].reduce((a, b) => a + b, 0);
  if (mapped < code.length) {
    bySource.set(
      "(unmapped)",
      (bySource.get("(unmapped)") ?? 0) + (code.length - mapped),
    );
  }

  return bySource;
}

function bucketOf(source) {
  const normalised = source.replace(/\\/g, "/");
  const nm = normalised.lastIndexOf("node_modules/");
  if (nm !== -1) {
    const rest = normalised.slice(nm + "node_modules/".length);
    const parts = rest.split("/");
    return parts[0].startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
  }
  if (normalised.includes("/src/")) {
    const rest = normalised.slice(normalised.indexOf("/src/") + 5);
    const parts = rest.split("/");
    return `src/${parts[0]}`;
  }
  return normalised;
}

function main() {
  const assets = readdirSync(resolve(DIST, "assets"));
  const jsFiles = assets.filter((f) => f.endsWith(".js"));
  const cssFiles = assets.filter((f) => f.endsWith(".css"));

  const report = { label: LABEL, chunks: [], byPackage: [], css: [] };

  const totals = new Map();

  for (const file of jsFiles) {
    const path = resolve(DIST, "assets", file);
    const code = readFileSync(path, "utf8");
    const raw = statSync(path).size;
    const gzip = gzipSync(readFileSync(path)).length;
    report.chunks.push({ file, raw, gzip });

    const mapPath = `${path}.map`;
    let map;
    try {
      map = JSON.parse(readFileSync(mapPath, "utf8"));
    } catch {
      continue;
    }

    for (const [source, size] of attribute(code, map)) {
      const bucket = bucketOf(source);
      totals.set(bucket, (totals.get(bucket) ?? 0) + size);
    }
  }

  for (const file of cssFiles) {
    const path = resolve(DIST, "assets", file);
    report.css.push({
      file,
      raw: statSync(path).size,
      gzip: gzipSync(readFileSync(path)).length,
    });
  }

  const totalJs = report.chunks.reduce((a, c) => a + c.raw, 0);
  report.byPackage = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, bytes]) => ({
      name,
      bytes,
      share: round((bytes / totalJs) * 100, 1),
    }));

  report.totalJsRaw = totalJs;
  report.totalJsGzip = report.chunks.reduce((a, c) => a + c.gzip, 0);
  report.chunkCount = report.chunks.length;

  const dir = ensureOutDir("bundle");
  const file = resolve(dir, `${LABEL}.json`);
  writeFileSync(file, JSON.stringify(report, null, 2) + "\n");

  console.log(
    `${report.chunkCount} JS chunk(s), ${report.totalJsRaw} B raw / ${report.totalJsGzip} B gzip`,
  );
  for (const row of report.byPackage.slice(0, 20)) {
    console.log(`  ${String(row.bytes).padStart(8)} B ${String(row.share).padStart(5)}%  ${row.name}`);
  }
  console.log(`\nwrote ${file}`);
}

main();
