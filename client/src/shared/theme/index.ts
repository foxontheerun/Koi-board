// Design tokens as TypeScript, because the canvas cannot read CSS variables:
// ctx.fillStyle needs a resolved colour string. The CSS variables in index.css
// mirror these values; this module is the source both sides should follow.

export const BRAND = {
  orange: "#FF6A3D",
  orangeHover: "#E85427",
  orangeTint: "#FFE3D6",
  aqua: "#16B8D4",
  aquaDeep: "#0E7C99",
  aquaTint: "#E3F6FB",
  mint: "#34D399",
} as const;

export const INK = {
  strong: "#1A1A1A",
  muted: "#666666",
} as const;

export const DANGER = "#DC2626";

// The strokes of the strong sticker presets, so text matches the palette people
// already pick from. Held at 600 rather than pushed darker: 700 turns orange to
// brick and yellow to mustard. That trades some contrast - these run 3.3:1 to
// 5.6:1 on white, short of the 4.5:1 for body copy - which is the right trade
// for large text on a canvas. Yellow is left out: no readable shade of it stays
// yellow.
export const TEXT_PALETTE = [
  "#111111",
  "#E11D48",
  "#EA580C",
  "#DB2777",
  "#7C3AED",
  "#2563EB",
  "#0D9488",
  "#16A34A",
] as const;
