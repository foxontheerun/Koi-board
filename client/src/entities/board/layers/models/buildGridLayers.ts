export interface GridLayerConfig {
  size: number; // фактический размер клетки в пикселях
  //   baseSize: number; // логический размер (25, 100, 400...)
  opacity: number;
  lineWidth: number;
}

export const BASE_GRID_COLOR = "205, 205, 205";
const BASE_UNIT = 25;

const MIN_VISIBLE_PX = 6;
const MAX_VISIBLE_PX = 260;

// GRID_LEVELS описывает вложенные уровни сетки.
// Каждая клетка уровня = baseSize * mult.
// mult — множитель относительно базового шага (25px):
//   mult = 1   →  25px   (мелкие линии)
//   mult = 4   → 100px   (средние линии)
//   mult = 16  → 400px   (крупные линии)
//   mult = 64  → 1600px  (очень крупные линии)
//
// ВАЖНО: все уровни строго кратны друг другу (1 → 4 → 16 → 64),
// благодаря чему толстые и тонкие линии ВСЕГДА совпадают по узлам
// при любом zoomScale и не “съезжают”. Это поведение как в Miro.

const GRID_LEVELS = [
  { mult: 1, minOpacity: 0.03, maxOpacity: 0.12, lineWidth: 1 }, // 25
  { mult: 4, minOpacity: 0.05, maxOpacity: 0.18, lineWidth: 1 }, // 100
  { mult: 16, minOpacity: 0.08, maxOpacity: 0.25, lineWidth: 1 }, // 400
  { mult: 64, minOpacity: 0.12, maxOpacity: 0.3, lineWidth: 1 }, // 1600
];

export const buildGridLayers = (zoom: number): GridLayerConfig[] => {
  const layers: GridLayerConfig[] = [];

  const baseRaw = BASE_UNIT * zoom;
  const baseSize = Math.round(baseRaw * 2) / 2;

  GRID_LEVELS.forEach((level) => {
    const size = baseSize * level.mult;

    if (size < MIN_VISIBLE_PX || size > MAX_VISIBLE_PX) return;

    // const relevance =
    //   1 -
    //   Math.min(
    //     1,
    //     Math.abs(size - IDEAL_GRID_PIXEL_SIZE) / IDEAL_GRID_PIXEL_SIZE
    //   );

    // const opacity =
    //   level.minOpacity +
    //   (level.maxOpacity - level.minOpacity) * Math.min(1, relevance);

    const opacity = level.minOpacity + (level.maxOpacity - level.minOpacity);

    layers.push({
      size,
      opacity,
      lineWidth: level.lineWidth,
    });
  });

  if (layers.length >= 3) {
    layers.sort((a, b) => a.size - b.size);
    layers.shift();
  }

  return layers.sort((a, b) => b.size - a.size);
};
