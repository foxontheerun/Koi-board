// Measurement hooks for docs/perf. Compiled in only when the bundle is built
// with VITE_PERF=1; in a normal build PERF_BUILD folds to false and every
// branch below is dropped, so nothing here reaches production.
export const PERF_BUILD = import.meta.env.VITE_PERF === "1";

interface PerfBridge {
  naive: boolean;
  samples: number[];
}

function createBridge(): PerfBridge {
  const w = window as unknown as { __koiPerf?: PerfBridge };
  if (!w.__koiPerf) w.__koiPerf = { naive: false, samples: [] };
  return w.__koiPerf;
}

export const perf: PerfBridge = PERF_BUILD
  ? createBridge()
  : { naive: false, samples: [] };
