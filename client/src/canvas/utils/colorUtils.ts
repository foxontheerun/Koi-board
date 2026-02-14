type ColorOperation = "lighten" | "darken";

export function adjustHexBrightness(
  hex: string,
  percent: number,
  operation: ColorOperation = "lighten" as ColorOperation
): string {
  hex = hex.replace(/^#/, "");

  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("");
  }

  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  percent = Math.min(100, Math.max(0, percent));

  let factor: number;
  if (operation === "lighten") {
    factor = 1 + percent / 100;
  } else {
    factor = 1 - percent / 100;
  }

  const newR = Math.min(255, Math.max(0, Math.round(r * factor)));
  const newG = Math.min(255, Math.max(0, Math.round(g * factor)));
  const newB = Math.min(255, Math.max(0, Math.round(b * factor)));

  const toHex = (n: number): string => {
    const hex = n.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
}
