import { segmentsFor, type TextFormat } from "./format";
import { metricsForAttributes } from "./metrics";
import { layoutSegments, type RichTextLayout } from "./richLayout";
import {
  DEFAULT_FONT_SIZE,
  DEFAULT_FONT_WEIGHT,
  TEXT_PADDING,
  contentWidth,
  lineHeightFor,
} from "./style";

const MAX_CACHE_ENTRIES = 4000;

// Layout runs per frame and per keystroke, and measuring is the expensive part.
// The key carries the attributes, not just the text: a bold word measured as
// regular would wrap in the wrong place.
const layouts = new Map<string, RichTextLayout>();

export function richLayoutFor(
  text: string,
  formats: TextFormat[],
  shapeWidth: number,
  base: { fontSize: number; fontWeight: number },
): RichTextLayout {
  const key = `${base.fontSize} ${base.fontWeight} ${Math.round(shapeWidth)} ${text} ${JSON.stringify(formats)}`;
  const cached = layouts.get(key);
  if (cached) return cached;

  const layout = layoutSegments(
    segmentsFor(text, formats),
    contentWidth(shapeWidth),
    metricsForAttributes(base),
  );

  if (layouts.size >= MAX_CACHE_ENTRIES) layouts.clear();
  layouts.set(key, layout);

  return layout;
}

// Measured through the same layout the painter uses, so a block sized to a
// paragraph that contains one large word is tall enough for it.
export function textBlockHeight(
  text: string,
  shapeWidth: number,
  fontSize: number = DEFAULT_FONT_SIZE,
  fontWeight: number = DEFAULT_FONT_WEIGHT,
  formats: TextFormat[] = [],
): number {
  const { height } = richLayoutFor(text, formats, shapeWidth, {
    fontSize,
    fontWeight,
  });

  // An empty block still stands one line tall.
  return Math.ceil((height || lineHeightFor(fontSize)) + TEXT_PADDING * 2);
}
