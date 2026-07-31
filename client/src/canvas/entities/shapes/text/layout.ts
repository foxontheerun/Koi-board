export type MeasureText = (text: string) => number;

export interface TextLayout {
  lines: string[];
  width: number;
  height: number;
}

const graphemeSegmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

// Splitting by code unit would tear apart emoji and combining marks.
function graphemes(word: string): string[] {
  if (!graphemeSegmenter) return Array.from(word);
  return Array.from(graphemeSegmenter.segment(word), (part) => part.segment);
}

function breakLongWord(
  word: string,
  maxWidth: number,
  measure: MeasureText,
  out: string[],
): string {
  let chunk = "";

  for (const grapheme of graphemes(word)) {
    const next = chunk + grapheme;
    if (chunk && measure(next) > maxWidth) {
      out.push(chunk);
      chunk = grapheme;
    } else {
      chunk = next;
    }
  }

  return chunk;
}

function wrapParagraph(
  paragraph: string,
  maxWidth: number,
  measure: MeasureText,
  out: string[],
) {
  let current = "";

  for (const word of paragraph.split(" ")) {
    const candidate = current ? `${current} ${word}` : word;

    if (measure(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      out.push(current);
      current = "";
    }

    current =
      measure(word) <= maxWidth
        ? word
        : breakLongWord(word, maxWidth, measure, out);
  }

  out.push(current);
}

export function wrapText(
  text: string,
  maxWidth: number,
  measure: MeasureText,
): string[] {
  if (!text) return [];
  if (maxWidth <= 0) return text.split("\n");

  const lines: string[] = [];

  for (const paragraph of text.split("\n")) {
    if (paragraph === "") {
      lines.push("");
      continue;
    }
    wrapParagraph(paragraph, maxWidth, measure, lines);
  }

  return lines;
}

export function layoutText(
  text: string,
  maxWidth: number,
  lineHeight: number,
  measure: MeasureText,
): TextLayout {
  const lines = wrapText(text, maxWidth, measure);

  return {
    lines,
    width: lines.reduce((widest, line) => Math.max(widest, measure(line)), 0),
    height: lines.length * lineHeight,
  };
}
