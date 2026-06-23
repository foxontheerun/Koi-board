import { describe, it, expect } from "vitest";
import { adjustHexBrightness, hexToRgba } from "./colorUtils";

describe("adjustHexBrightness", () => {
  it("returns the color unchanged at 0%", () => {
    expect(adjustHexBrightness("#808080", 0)).toBe("#808080");
  });

  it("darkens to black at 100%", () => {
    expect(adjustHexBrightness("#808080", 100, "darken")).toBe("#000000");
  });

  it("keeps #ffffff white when lightening", () => {
    expect(adjustHexBrightness("#ffffff", 50)).toBe("#ffffff");
  });

  it("expands shorthand #f00 to #ff0000", () => {
    expect(adjustHexBrightness("#f00", 0)).toBe("#ff0000");
  });

  it("preserves the alpha channel of #rrggbbaa", () => {
    expect(adjustHexBrightness("#80808080", 0)).toBe("#80808080");
  });

  it("keeps rgb() format for rgb input", () => {
    expect(adjustHexBrightness("rgb(128, 128, 128)", 0)).toBe(
      "rgb(128, 128, 128)",
    );
  });

  it("returns invalid input unchanged", () => {
    expect(adjustHexBrightness("hello", 50)).toBe("hello");
  });

  it("returns an incomplete hex unchanged", () => {
    expect(adjustHexBrightness("#12", 50)).toBe("#12");
  });
});

describe("hexToRgba", () => {
  it("converts #ff0000 to rgba with alpha 1 by default", () => {
    expect(hexToRgba("#ff0000")).toBe("rgba(255, 0, 0, 1)");
  });

  it("forwards the given alpha", () => {
    expect(hexToRgba("#ff0000", 0.5)).toBe("rgba(255, 0, 0, 0.5)");
  });

  it("works without a leading '#'", () => {
    expect(hexToRgba("00ff00")).toBe("rgba(0, 255, 0, 1)");
  });

  it("expands shorthand #0f0", () => {
    expect(hexToRgba("#0f0")).toBe("rgba(0, 255, 0, 1)");
  });

  it("alpha from #rrggbbaa overrides the alpha argument", () => {
    // hex alpha ff (= 1) wins over the passed 0.5
    expect(hexToRgba("#ff0000ff", 0.5)).toBe("rgba(255, 0, 0, 1)");
  });
});
