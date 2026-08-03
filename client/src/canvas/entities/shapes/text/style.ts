import { INK, TEXT_PALETTE } from "../../../../shared/theme";

// Single source of truth for text metrics: the canvas painter and the DOM
// editor overlay must agree exactly, or text shifts when editing ends.
export const TEXT_PADDING = 8;
export const TEXT_FONT_FAMILY = "sans-serif";
export const TEXT_LINE_HEIGHT_RATIO = 1.4;
export const DEFAULT_FONT_SIZE = 14;
export const MIN_FONT_SIZE = 4;
export const MAX_FONT_SIZE = 240;
export const TEXT_COLOR = INK.strong;
export const STICKER_TEXT_COLOR = INK.strong;
export const DEFAULT_TEXT_WIDTH = 240;
export const MIN_TEXT_WIDTH = 40;
export const DEFAULT_FONT_WEIGHT = 400;
export const BOLD_FONT_WEIGHT = 700;
export const FONT_SIZE_STEPS = [12, 14, 18, 24, 32, 48, 64];
export const TEXT_COLORS = TEXT_PALETTE;

export function fontString(
  fontSize: number = DEFAULT_FONT_SIZE,
  fontWeight: number = DEFAULT_FONT_WEIGHT,
  italic = false,
): string {
  // Style comes first in the shorthand, and italic changes the glyphs' widths,
  // so it has to be part of what gets measured.
  return `${italic ? "italic " : ""}${fontWeight} ${fontSize}px ${TEXT_FONT_FAMILY}`;
}

// Where a strikethrough sits, as a fraction of the font size above the
// baseline, with a thickness that scales with it.
export const STRIKE_OFFSET_RATIO = 0.28;
export const STRIKE_THICKNESS_RATIO = 1 / 14;

export function lineHeightFor(fontSize: number = DEFAULT_FONT_SIZE): number {
  return fontSize * TEXT_LINE_HEIGHT_RATIO;
}

export function contentWidth(shapeWidth: number): number {
  return Math.max(0, shapeWidth - TEXT_PADDING * 2);
}

export function clampFontSize(fontSize: number): number {
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, fontSize));
}
