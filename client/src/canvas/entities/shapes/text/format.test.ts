import { describe, it, expect } from "vitest";
import {
  MIXED,
  applyFormat,
  attributesIn,
  parseFormats,
  segmentsFor,
  serializeFormats,
  type TextFormat,
} from "./format";

const bold = (index: number, length: number): TextFormat => ({
  index,
  length,
  attributes: { bold: true },
});

describe("segmentsFor", () => {
  it("returns nothing for empty text", () => {
    expect(segmentsFor("", [])).toEqual([]);
  });

  it("returns one plain segment when nothing is formatted", () => {
    expect(segmentsFor("hello", [])).toEqual([
      { text: "hello", attributes: {} },
    ]);
  });

  it("splits where a format starts and ends", () => {
    expect(segmentsFor("one two", [bold(4, 3)])).toEqual([
      { text: "one ", attributes: {} },
      { text: "two", attributes: { bold: true } },
    ]);
  });

  it("merges neighbours that ended up equal", () => {
    const formats = [bold(0, 2), bold(2, 3)];

    expect(segmentsFor("hello", formats)).toEqual([
      { text: "hello", attributes: { bold: true } },
    ]);
  });

  it("combines attributes where formats overlap", () => {
    const formats: TextFormat[] = [
      bold(0, 5),
      { index: 3, length: 4, attributes: { color: "#f00" } },
    ];

    expect(segmentsFor("abcdefg", formats)).toEqual([
      { text: "abc", attributes: { bold: true } },
      { text: "de", attributes: { bold: true, color: "#f00" } },
      { text: "fg", attributes: { color: "#f00" } },
    ]);
  });

  it("lets a later format win over an earlier one", () => {
    const formats: TextFormat[] = [
      { index: 0, length: 5, attributes: { fontSize: 14 } },
      { index: 0, length: 5, attributes: { fontSize: 32 } },
    ];

    expect(segmentsFor("hello", formats)[0].attributes.fontSize).toBe(32);
  });

  it("ignores a range beyond the text", () => {
    expect(segmentsFor("hi", [bold(5, 4)])).toEqual([
      { text: "hi", attributes: {} },
    ]);
  });
});

describe("applyFormat", () => {
  it("formats a range", () => {
    const formats = applyFormat([], { index: 0, length: 3 }, { bold: true }, 5);

    expect(segmentsFor("hello", formats)).toEqual([
      { text: "hel", attributes: { bold: true } },
      { text: "lo", attributes: {} },
    ]);
  });

  it("keeps an explicit off rather than dropping the range", () => {
    const on = applyFormat([], { index: 0, length: 5 }, { bold: true }, 5);
    const off = applyFormat(on, { index: 0, length: 2 }, { bold: false }, 5);

    expect(segmentsFor("hello", off)).toEqual([
      { text: "he", attributes: { bold: false } },
      { text: "llo", attributes: { bold: true } },
    ]);
  });

  it("leaves attributes it does not mention alone", () => {
    const coloured = applyFormat(
      [],
      { index: 0, length: 5 },
      { color: "#f00" },
      5,
    );
    const bolded = applyFormat(
      coloured,
      { index: 0, length: 5 },
      { bold: true },
      5,
    );

    expect(segmentsFor("hello", bolded)[0].attributes).toEqual({
      bold: true,
      color: "#f00",
    });
  });

  it("does nothing for an empty range", () => {
    const formats = applyFormat([], { index: 2, length: 0 }, { bold: true }, 5);

    expect(formats).toEqual([]);
  });

  it("keeps the result sorted and non-overlapping", () => {
    const formats = applyFormat(
      applyFormat([], { index: 4, length: 2 }, { bold: true }, 8),
      { index: 0, length: 2 },
      { bold: true },
      8,
    );

    const ends = formats.map((f) => f.index + f.length);
    expect(formats.map((f) => f.index)).toEqual(
      [...formats.map((f) => f.index)].sort((a, b) => a - b),
    );
    expect(
      ends.slice(0, -1).every((end, i) => end <= formats[i + 1].index),
    ).toBe(true);
  });
});

describe("attributesIn", () => {
  it("reports a shared value", () => {
    const formats = applyFormat([], { index: 0, length: 5 }, { bold: true }, 5);

    expect(attributesIn(formats, { index: 1, length: 3 }, 5).bold).toBe(true);
  });

  it("reports mixed when the selection disagrees", () => {
    const formats = applyFormat([], { index: 0, length: 2 }, { bold: true }, 5);

    expect(attributesIn(formats, { index: 0, length: 5 }, 5).bold).toBe(MIXED);
  });

  it("reports undefined where nothing is set", () => {
    expect(attributesIn([], { index: 0, length: 5 }, 5)).toEqual({
      bold: undefined,
      fontSize: undefined,
      color: undefined,
    });
  });

  it("reports undefined for an empty selection", () => {
    const formats = applyFormat([], { index: 0, length: 5 }, { bold: true }, 5);

    expect(
      attributesIn(formats, { index: 2, length: 0 }, 5).bold,
    ).toBeUndefined();
  });
});

describe("parseFormats", () => {
  it("round-trips through serialisation", () => {
    const formats = applyFormat([], { index: 1, length: 3 }, { bold: true }, 5);

    expect(parseFormats(serializeFormats(formats))).toEqual(formats);
  });

  it("serialises nothing as null, so the column stays empty", () => {
    expect(serializeFormats([])).toBeNull();
  });

  it("treats unreadable input as unformatted instead of throwing", () => {
    expect(parseFormats("not json")).toEqual([]);
    expect(parseFormats("{}")).toEqual([]);
    expect(parseFormats(null)).toEqual([]);
  });

  it("drops entries that are not formats", () => {
    const raw = '[{"index":0,"length":2,"attributes":{}},{"nope":1}]';

    expect(parseFormats(raw)).toHaveLength(1);
  });
});
