import { useMemo } from "react";

interface GridLayer {
  size: number; // фактический размер клетки в пикселях
  baseSize: number; // логический размер (25, 100, 400...)
  opacity: number;
  lineWidth: number;
}

const BASE_GRID_COLOR = "205, 205, 205";
const BASE_UNIT = 25;

const MIN_VISIBLE_PX = 6;
const MAX_VISIBLE_PX = 260;
const IDEAL_GRID_PIXEL_SIZE = 100;

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

const buildGridLayers = (zoomScale: number): GridLayer[] => {
  const layers: GridLayer[] = [];

  const baseRaw = BASE_UNIT * zoomScale;
  const baseSize = Math.round(baseRaw * 2) / 2;

  GRID_LEVELS.forEach((level) => {
    const size = baseSize * level.mult;

    if (size < MIN_VISIBLE_PX || size > MAX_VISIBLE_PX) return;

    const relevance =
      1 -
      Math.min(
        1,
        Math.abs(size - IDEAL_GRID_PIXEL_SIZE) / IDEAL_GRID_PIXEL_SIZE
      );

    const opacity =
      level.minOpacity +
      (level.maxOpacity - level.minOpacity) * Math.max(0, relevance);

    layers.push({
      size,
      baseSize: BASE_UNIT * level.mult,
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

/**
 * Возвращает inline-стили для фоновой сетки доски.
 * Сетка состоит из нескольких слоёв (разных шагов), привязанных к zoomScale,
 * с отключением слишком мелких/слишком крупных уровней и мягкой подстройкой прозрачности.
 */
export const useGridSystem = (zoomScale: number) => {
  return useMemo(() => {
    const layers = buildGridLayers(zoomScale);

    const backgrounds: string[] = [];
    const sizes: string[] = [];
    const positions: string[] = [];

    layers.forEach((layer) => {
      backgrounds.push(
        `linear-gradient(rgba(${BASE_GRID_COLOR}, ${layer.opacity}) ${layer.lineWidth}px, transparent ${layer.lineWidth}px)`,
        `linear-gradient(90deg, rgba(${BASE_GRID_COLOR}, ${layer.opacity}) ${layer.lineWidth}px, transparent ${layer.lineWidth}px)`
      );

      sizes.push(
        `${layer.size}px ${layer.size}px`,
        `${layer.size}px ${layer.size}px`
      );

      positions.push("0 0", "0 0");
    });

    return {
      backgroundImage: backgrounds.join(", "),
      backgroundSize: sizes.join(", "),
      backgroundPosition: positions.join(", "),
      backgroundColor: "#fafafa",
    } as const;
  }, [zoomScale]);
};
