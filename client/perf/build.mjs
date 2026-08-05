import { spawnSync } from "node:child_process";
import { CLIENT_DIR } from "./lib.mjs";

// Every measured build is produced here rather than by `npm run build`, so a
// local .env cannot change what was measured. VITE_DEV_NO_AUTH is pinned off:
// a build that skips the login screen is not the build users would get.
const VARIANTS = {
  measured: { outDir: "dist", env: { VITE_DEV_NO_AUTH: "0" } },
  perf: {
    outDir: "dist-perf",
    env: { VITE_DEV_NO_AUTH: "0", VITE_PERF: "1" },
  },
  sourcemap: {
    outDir: "dist-map",
    env: { VITE_DEV_NO_AUTH: "0" },
    extra: ["--sourcemap"],
  },
};

const wanted = process.argv.slice(2);
const names = wanted.length ? wanted : Object.keys(VARIANTS);

for (const name of names) {
  const variant = VARIANTS[name];
  if (!variant) throw new Error(`unknown build variant: ${name}`);

  console.log(`\n=== building ${name} -> ${variant.outDir} ===`);
  const result = spawnSync(
    "npx",
    ["vite", "build", "--outDir", variant.outDir, ...(variant.extra ?? [])],
    {
      cwd: CLIENT_DIR,
      stdio: "inherit",
      shell: true,
      env: { ...process.env, ...variant.env },
    },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
