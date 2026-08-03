import { describe, it, expect } from "vitest";
import { layoutSegments, type MetricsFor } from "./richLayout";
import type { TextSegment } from "./format";

// Arithmetic stand-in for a font: every grapheme is half the size wide, and the
// vertical metrics keep the proportions a real face has.
const metricsFor: MetricsFor = (attributes) => {
  const size = attributes.fontSize ?? 10;
  const weight = attributes.bold ? 1.2 : 1;

  return {
    measure: (text) => Array.from(text).length * size * 0.5 * weight,
    ascent: size * 0.8,
    descent: size * 0.2,
    lineHeight: size * 1.4,
  };
};

const plain = (text: string): TextSegment[] => [{ text, attributes: {} }];

describe("layoutSegments", () => {
  it("lays out nothing for empty text", () => {
    expect(layoutSegments([], 100, metricsFor)).toEqual({
      lines: [],
      width: 0,
      height: 0,
    });
  });

  it("keeps a line that fits", () => {
    const layout = layoutSegments(plain("one two"), 100, metricsFor);

    expect(layout.lines).toHaveLength(1);
    expect(layout.lines[0].segments[0].text).toBe("one two");
  });

  it("wraps between words", () => {
    const layout = layoutSegments(plain("one two three"), 40, metricsFor);

    expect(layout.lines.map((line) => line.segments[0].text)).toEqual([
      "one two",
      "three",
    ]);
  });

  it("honours explicit line breaks", () => {
    const layout = layoutSegments(plain("one\ntwo"), 100, metricsFor);

    expect(layout.lines).toHaveLength(2);
  });

  it("wraps a word that spans two segments", () => {
    const segments: TextSegment[] = [
      { text: "one ha", attributes: {} },
      { text: "lf", attributes: { bold: true } },
    ];

    const layout = layoutSegments(segments, 30, metricsFor);

    // "half" is one word even though it changes style midway, so it moves to
    // the next line whole.
    expect(layout.lines).toHaveLength(2);
    expect(layout.lines[1].segments.map((s) => s.text).join("")).toBe("half");
  });

  it("places segments left to right within a line", () => {
    const segments: TextSegment[] = [
      { text: "ab", attributes: {} },
      { text: "cd", attributes: { bold: true } },
    ];

    const [line] = layoutSegments(segments, 200, metricsFor).lines;

    expect(line.segments[0].x).toBe(0);
    expect(line.segments[1].x).toBe(line.segments[0].width);
    expect(line.width).toBe(line.segments[0].width + line.segments[1].width);
  });

  it("takes line height from the tallest segment on the line", () => {
    const segments: TextSegment[] = [
      { text: "small ", attributes: { fontSize: 10 } },
      { text: "big", attributes: { fontSize: 40 } },
    ];

    const [line] = layoutSegments(segments, 500, metricsFor).lines;

    expect(line.height).toBe(40 * 1.4);
  });

  it("puts every segment on the line on one baseline", () => {
    const segments: TextSegment[] = [
      { text: "small ", attributes: { fontSize: 10 } },
      { text: "big", attributes: { fontSize: 40 } },
    ];

    const [line] = layoutSegments(segments, 500, metricsFor).lines;

    // The baseline is deep enough for the largest ascent, and leaves room below
    // for its descent.
    expect(line.baseline).toBeGreaterThanOrEqual(40 * 0.8);
    expect(line.height - line.baseline).toBeGreaterThanOrEqual(40 * 0.2);
  });

  it("adds up height across lines of differing size", () => {
    const segments: TextSegment[] = [
      { text: "small\n", attributes: { fontSize: 10 } },
      { text: "big", attributes: { fontSize: 40 } },
    ];

    const layout = layoutSegments(segments, 500, metricsFor);

    expect(layout.height).toBe(10 * 1.4 + 40 * 1.4);
  });

  it("measures a bold word as bold when deciding where to wrap", () => {
    // 9 graphemes: 45 wide regular, 54 bold - the limit sits between them.
    const regular = layoutSegments(plain("aaaa bbbb"), 50, metricsFor);
    const bold = layoutSegments(
      [{ text: "aaaa bbbb", attributes: { bold: true } }],
      50,
      metricsFor,
    );

    expect(regular.lines).toHaveLength(1);
    expect(bold.lines.length).toBeGreaterThan(1);
  });

  it("splits a word too long for any line", () => {
    const layout = layoutSegments(plain("abcdefgh"), 30, metricsFor);

    expect(layout.lines.length).toBeGreaterThan(1);
    expect(
      layout.lines.map((line) => line.segments.map((s) => s.text).join("")).join(""),
    ).toBe("abcdefgh");
  });

  it("moves a long word to its own line before splitting it", () => {
    const layout = layoutSegments(plain("hi abcdefgh"), 30, metricsFor);
    const lines = layout.lines.map((line) =>
      line.segments.map((s) => s.text).join(""),
    );

    expect(lines[0]).toBe("hi");
    expect(lines.slice(1).join("")).toBe("abcdefgh");
  });

  it("splits by grapheme, keeping a mark with its letter", () => {
    // An escape, so the file's own normalisation cannot collapse it: a base
    // letter plus a combining acute is one grapheme of two code points.
    const acute = "\u0301";
    const accented = `e${acute}`;
    const layout = layoutSegments(plain(accented.repeat(3)), 20, metricsFor);
    const lines = layout.lines.map((line) =>
      line.segments.map((s) => s.text).join(""),
    );

    expect(lines.join("")).toBe(accented.repeat(3));
    // A line never opens with a mark that belongs to the letter before it.
    expect(lines.every((line) => !line.startsWith(acute))).toBe(true);
  });

  it("falls back to unwrapped lines when there is no width to fit", () => {
    const layout = layoutSegments(plain("one two"), 0, metricsFor);

    expect(layout.lines).toHaveLength(1);
    expect(layout.lines[0].segments[0].text).toBe("one two");
  });

  it("gives an empty line its own height", () => {
    const layout = layoutSegments(plain("one\n\ntwo"), 100, metricsFor);

    expect(layout.lines).toHaveLength(3);
    expect(layout.lines[1].height).toBe(10 * 1.4);
  });
});
