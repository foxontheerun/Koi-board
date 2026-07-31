import { describe, it, expect } from "vitest";
import { layoutText, wrapText } from "./layout";

// Monospace stand-in: every grapheme is 10 units wide.
const measure = (text: string) => Array.from(text).length * 10;

describe("wrapText", () => {
  it("returns nothing for empty text", () => {
    expect(wrapText("", 100, measure)).toEqual([]);
  });

  it("keeps a line that fits", () => {
    expect(wrapText("one two", 100, measure)).toEqual(["one two"]);
  });

  it("breaks between words once the line is full", () => {
    expect(wrapText("one two three", 70, measure)).toEqual([
      "one two",
      "three",
    ]);
  });

  it("honours explicit line breaks", () => {
    expect(wrapText("one\ntwo", 100, measure)).toEqual(["one", "two"]);
  });

  it("keeps blank lines between paragraphs", () => {
    expect(wrapText("one\n\ntwo", 100, measure)).toEqual(["one", "", "two"]);
  });

  it("splits a word too long for any line", () => {
    expect(wrapText("abcdefgh", 30, measure)).toEqual(["abc", "def", "gh"]);
  });

  it("moves a long word to its own line before splitting it", () => {
    expect(wrapText("hi abcdefgh", 30, measure)).toEqual([
      "hi",
      "abc",
      "def",
      "gh",
    ]);
  });

  it("splits by grapheme, keeping a mark with its letter", () => {
    // An escape, so the file's own normalisation cannot collapse it: a base
    // letter plus a combining acute is one grapheme of two code points.
    const acute = "\u0301";
    const accented = `e${acute}`;
    const lines = wrapText(accented.repeat(3), 20, measure);

    expect(lines).toEqual([accented, accented, accented]);
    expect(lines.every((line) => !line.startsWith(acute))).toBe(true);
  });

  it("falls back to raw lines when there is no width to fit", () => {
    expect(wrapText("one two", 0, measure)).toEqual(["one two"]);
  });
});

describe("layoutText", () => {
  it("reports height from the line count", () => {
    const layout = layoutText("one two three", 70, 20, measure);

    expect(layout.lines).toHaveLength(2);
    expect(layout.height).toBe(40);
  });

  it("reports the width of the widest line", () => {
    const layout = layoutText("one two three", 70, 20, measure);

    expect(layout.width).toBe(70);
  });

  it("is empty for empty text", () => {
    expect(layoutText("", 100, 20, measure)).toEqual({
      lines: [],
      width: 0,
      height: 0,
    });
  });
});
