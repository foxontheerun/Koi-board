import type { MeasureText, MetricsFor } from "./richLayout";
import type { TextAttributes } from "./format";
import {
  BOLD_FONT_WEIGHT,
  DEFAULT_FONT_SIZE,
  DEFAULT_FONT_WEIGHT,
  fontString,
  lineHeightFor,
} from "./style";

const MAX_CACHE_ENTRIES = 4000;

let measureCtx: CanvasRenderingContext2D | null = null;
const widths = new Map<string, number>();

// Measuring on the rendering context would mean overwriting its font mid-paint.
function context(): CanvasRenderingContext2D | null {
  if (measureCtx) return measureCtx;
  if (typeof document === "undefined") return null;

  measureCtx = document.createElement("canvas").getContext("2d");
  return measureCtx;
}

// Without a canvas - unit tests, SSR - fall back to a rough average glyph width
// so layout stays deterministic instead of throwing. The size has to be picked
// out by unit: a font shorthand starts with the weight.
function approximate(font: string): MeasureText {
  const fontSize = Number.parseFloat(/(d+(.d+)?)px/.exec(font)?.[1] ?? "");
  return (text) =>
    Array.from(text).length * (fontSize || DEFAULT_FONT_SIZE) * 0.5;
}

// CSS centres a line inside its line box, canvas draws from the em box top.
// Reproducing that offset needs the font's own ascent and descent.
export function fontMetricsFor(
  font: string,
  fontSize: number,
): { ascent: number; halfLeading: number } {
  const lineHeight = lineHeightFor(fontSize);
  const ctx = context();

  if (!ctx) {
    return { ascent: fontSize * 0.8, halfLeading: (lineHeight - fontSize) / 2 };
  }

  ctx.font = font;
  const metrics = ctx.measureText("Hg");
  const ascent = metrics.fontBoundingBoxAscent ?? fontSize * 0.8;
  const descent = metrics.fontBoundingBoxDescent ?? fontSize * 0.2;

  return { ascent, halfLeading: (lineHeight - (ascent + descent)) / 2 };
}

export function measurerFor(font: string): MeasureText {
  const ctx = context();
  if (!ctx) return approximate(font);

  return (text: string) => {
    const key = `${font} ${text}`;
    const cached = widths.get(key);
    if (cached !== undefined) return cached;

    ctx.font = font;
    if (widths.size >= MAX_CACHE_ENTRIES) widths.clear();

    const width = ctx.measureText(text).width;
    widths.set(key, width);
    return width;
  };
}

// Supplies the layout with real font metrics per style. Attributes fall through
// to the shape's own where they say nothing.
export function metricsForAttributes(base: {
  fontSize: number;
  fontWeight: number;
}): MetricsFor {
  return (attributes: TextAttributes) => {
    const fontSize = attributes.fontSize ?? base.fontSize;
    const fontWeight = attributes.bold
      ? BOLD_FONT_WEIGHT
      : attributes.bold === false
        ? DEFAULT_FONT_WEIGHT
        : base.fontWeight;

    const font = fontString(fontSize, fontWeight, attributes.italic === true);
    const { ascent, halfLeading } = fontMetricsFor(font, fontSize);
    const lineHeight = lineHeightFor(fontSize);

    return {
      measure: measurerFor(font),
      ascent,
      descent: lineHeight - halfLeading * 2 - ascent,
      lineHeight,
    };
  };
}
