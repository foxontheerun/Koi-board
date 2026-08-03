import type { TextAttributes, TextSegment } from "./format";
import { graphemes } from "./graphemes";

export type MeasureText = (text: string) => number;

// What the layout needs to know about one style. Injected, so this module stays
// pure and testable: the canvas supplies real font metrics, tests supply
// arithmetic.
export interface SegmentMetrics {
  measure: MeasureText;
  ascent: number;
  descent: number;
  lineHeight: number;
}

export type MetricsFor = (attributes: TextAttributes) => SegmentMetrics;

export interface PlacedSegment extends TextSegment {
  x: number;
  width: number;
}

export interface LaidOutLine {
  segments: PlacedSegment[];
  width: number;
  height: number;
  // Distance from the top of the line to the shared baseline. Segments of
  // different sizes sit on it, which is what keeps mixed text from bouncing.
  baseline: number;
}

export interface RichTextLayout {
  lines: LaidOutLine[];
  width: number;
  height: number;
}

interface Atom {
  text: string;
  attributes: TextAttributes;
}

const ATTRIBUTE_KEYS = ["bold", "fontSize", "color"] as const;

function sameAttributes(a: TextAttributes, b: TextAttributes): boolean {
  return ATTRIBUTE_KEYS.every((key) => a[key] === b[key]);
}

// Graphemes rather than characters, so a mark is never separated from its
// letter, and each carries the style of the segment it came from - a word may
// span several.
function atomsOf(segments: TextSegment[]): Atom[] {
  return segments.flatMap((segment) =>
    graphemes(segment.text).map((text) => ({
      text,
      attributes: segment.attributes,
    })),
  );
}

function groupAtoms(atoms: Atom[]): TextSegment[] {
  const grouped: TextSegment[] = [];

  for (const atom of atoms) {
    const last = grouped[grouped.length - 1];

    if (last && sameAttributes(last.attributes, atom.attributes)) {
      last.text += atom.text;
      continue;
    }

    grouped.push({ text: atom.text, attributes: atom.attributes });
  }

  return grouped;
}

function widthOf(atoms: Atom[], metricsFor: MetricsFor): number {
  return groupAtoms(atoms).reduce(
    (total, segment) => total + metricsFor(segment.attributes).measure(segment.text),
    0,
  );
}

function place(atoms: Atom[], metricsFor: MetricsFor): LaidOutLine {
  let x = 0;
  let ascent = 0;
  let descent = 0;
  let height = 0;

  const segments = groupAtoms(atoms).map((segment) => {
    const metrics = metricsFor(segment.attributes);
    const width = metrics.measure(segment.text);

    ascent = Math.max(ascent, metrics.ascent);
    descent = Math.max(descent, metrics.descent);
    height = Math.max(height, metrics.lineHeight);

    const placed: PlacedSegment = { ...segment, x, width };
    x += width;

    return placed;
  });

  // An empty line still occupies its own height, taken from the style that
  // would have been used there.
  if (segments.length === 0) {
    const metrics = metricsFor({});
    ascent = metrics.ascent;
    descent = metrics.descent;
    height = metrics.lineHeight;
  }

  return {
    segments,
    width: x,
    height,
    // Centre the text box within the line box, the way CSS distributes leading.
    baseline: (height - (ascent + descent)) / 2 + ascent,
  };
}

function splitOversizedWord(
  word: Atom[],
  maxWidth: number,
  metricsFor: MetricsFor,
  out: Atom[][],
): Atom[] {
  let chunk: Atom[] = [];

  for (const atom of word) {
    const next = [...chunk, atom];

    if (chunk.length > 0 && widthOf(next, metricsFor) > maxWidth) {
      out.push(chunk);
      chunk = [atom];
    } else {
      chunk = next;
    }
  }

  return chunk;
}

function wrapParagraph(
  paragraph: Atom[],
  maxWidth: number,
  metricsFor: MetricsFor,
  out: Atom[][],
) {
  const words: Atom[][] = [[]];

  for (const atom of paragraph) {
    if (atom.text === " ") {
      words.push([]);
      continue;
    }
    words[words.length - 1].push(atom);
  }

  const space = (attributes: TextAttributes): Atom => ({
    text: " ",
    attributes,
  });

  let current: Atom[] = [];

  words.forEach((word, index) => {
    const separator = index === 0 ? [] : [space(word[0]?.attributes ?? {})];
    const candidate =
      current.length === 0 && index === 0
        ? word
        : [...current, ...separator, ...word];

    if (widthOf(candidate, metricsFor) <= maxWidth) {
      current = candidate;
      return;
    }

    if (current.length > 0) {
      out.push(current);
      current = [];
    }

    current =
      widthOf(word, metricsFor) <= maxWidth
        ? word
        : splitOversizedWord(word, maxWidth, metricsFor, out);
  });

  out.push(current);
}

export function layoutSegments(
  segments: TextSegment[],
  maxWidth: number,
  metricsFor: MetricsFor,
): RichTextLayout {
  const paragraphs: Atom[][] = [[]];

  for (const atom of atomsOf(segments)) {
    if (atom.text === "\n") {
      paragraphs.push([]);
      continue;
    }
    paragraphs[paragraphs.length - 1].push(atom);
  }

  const wrapped: Atom[][] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      wrapped.push([]);
      continue;
    }

    if (maxWidth <= 0) {
      wrapped.push(paragraph);
      continue;
    }

    wrapParagraph(paragraph, maxWidth, metricsFor, wrapped);
  }

  const hasText = segments.some((segment) => segment.text.length > 0);
  const lines = hasText ? wrapped.map((line) => place(line, metricsFor)) : [];

  return {
    lines,
    width: lines.reduce((widest, line) => Math.max(widest, line.width), 0),
    height: lines.reduce((total, line) => total + line.height, 0),
  };
}
