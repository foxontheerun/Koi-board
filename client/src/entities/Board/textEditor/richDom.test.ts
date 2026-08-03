// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { readFrom, renderInto, restoreSelection, selectionRange } from "./richDom";
import { applyFormat } from "../../../canvas/entities/shapes/text";

let host: HTMLElement;

beforeEach(() => {
  host = document.createElement("div");
  document.body.replaceChildren(host);
});

describe("renderInto / readFrom", () => {
  it("round-trips plain text", () => {
    renderInto(host, "hello", []);

    expect(readFrom(host)).toEqual({ text: "hello", formats: [] });
  });

  it("round-trips a formatted range", () => {
    const formats = applyFormat([], { index: 0, length: 3 }, { bold: true }, 5);
    renderInto(host, "hello", formats);

    expect(readFrom(host)).toEqual({ text: "hello", formats });
  });

  it("round-trips several attributes at once", () => {
    const formats = applyFormat(
      [],
      { index: 2, length: 3 },
      { bold: true, fontSize: 24, color: "#ff0000" },
      8,
    );
    renderInto(host, "abcdefgh", formats);

    expect(readFrom(host)).toEqual({ text: "abcdefgh", formats });
  });

  it("survives repeated round-trips without drifting", () => {
    const formats = applyFormat([], { index: 1, length: 2 }, { bold: true }, 5);

    renderInto(host, "hello", formats);
    const once = readFrom(host);
    renderInto(host, once.text, once.formats);
    const twice = readFrom(host);

    expect(twice).toEqual(once);
  });

  it("reads styles the browser nested rather than losing them", () => {
    host.innerHTML =
      '<span data-bold="true"><span data-color="#ff0000">hi</span></span>';

    expect(readFrom(host)).toEqual({
      text: "hi",
      formats: [
        { index: 0, length: 2, attributes: { bold: true, color: "#ff0000" } },
      ],
    });
  });

  it("lets an inner span override the one around it", () => {
    host.innerHTML =
      '<span data-bold="true">a<span data-bold="false">b</span></span>';

    const { formats } = readFrom(host);

    expect(formats[0].attributes.bold).toBe(true);
    expect(formats[1].attributes.bold).toBe(false);
  });

  it("treats a line break as a newline", () => {
    host.innerHTML = "<span>one</span><br><span>two</span>";

    expect(readFrom(host).text).toBe("one\ntwo");
  });

  it("merges neighbouring nodes that share a style", () => {
    host.innerHTML = '<span data-bold="true">on</span><span data-bold="true">e</span>';

    expect(readFrom(host).formats).toHaveLength(1);
  });
});

describe("selectionRange", () => {
  it("reports the selected range in text indices", () => {
    renderInto(host, "hello world", []);
    restoreSelection(host, { index: 6, length: 5 });

    expect(selectionRange(host)).toEqual({ index: 6, length: 5 });
  });

  it("reports a collapsed caret as zero length", () => {
    renderInto(host, "hello", []);
    restoreSelection(host, { index: 3, length: 0 });

    expect(selectionRange(host)).toEqual({ index: 3, length: 0 });
  });

  it("crosses a style boundary", () => {
    const formats = applyFormat([], { index: 0, length: 3 }, { bold: true }, 8);
    renderInto(host, "abcdefgh", formats);
    restoreSelection(host, { index: 1, length: 5 });

    expect(selectionRange(host)).toEqual({ index: 1, length: 5 });
  });
});
