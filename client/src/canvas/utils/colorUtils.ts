type ColorOperation = "lighten" | "darken";

export function adjustHexBrightness(
  color: string,
  percent: number,
  operation: ColorOperation = "lighten",
): string {
  const rgb = parseColorToRgb(color);
  if (!rgb) {
    console.warn(`Unsupported color format: ${color}`);
    return color;
  }

  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);

  const clampedPercent = Math.min(100, Math.max(0, percent));
  const delta = clampedPercent / 100;

  let nextL: number;

  if (operation === "lighten") {
    // двигаем lightness вверх мягко, без выбеливания
    nextL = l + (1 - l) * delta;
  } else {
    // двигаем lightness вниз, сохраняя hue/saturation
    nextL = l * (1 - delta);
  }

  const { r, g, b } = hslToRgb(h, s, nextL);
  return rgbToHex(r, g, b);
}

function parseColorToRgb(
  color: string,
): { r: number; g: number; b: number } | null {
  let value = color.trim();

  if (value.startsWith("#")) {
    value = value.slice(1);

    // #rrggbbaa -> #rrggbb
    if (value.length === 8) {
      value = value.slice(0, 6);
    }

    // #rgb -> #rrggbb
    if (value.length === 3) {
      value = value
        .split("")
        .map((char) => char + char)
        .join("");
    }

    if (value.length !== 6) return null;

    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);

    if ([r, g, b].some(Number.isNaN)) return null;

    return { r, g, b };
  }

  if (value.startsWith("rgb")) {
    const match = value.match(/\d+(\.\d+)?/g);
    if (!match || match.length < 3) return null;

    const r = Math.round(Number(match[0]));
    const g = Math.round(Number(match[1]));
    const b = Math.round(Number(match[2]));

    if ([r, g, b].some(Number.isNaN)) return null;

    return { r, g, b };
  }

  return null;
}

function rgbToHsl(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  const l = (max + min) / 2;

  let s = 0;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));

    switch (max) {
      case rn:
        h = 60 * (((gn - bn) / delta) % 6);
        break;
      case gn:
        h = 60 * ((bn - rn) / delta + 2);
        break;
      case bn:
        h = 60 * ((rn - gn) / delta + 4);
        break;
    }
  }

  if (h < 0) h += 360;

  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hh = h / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (hh >= 0 && hh < 1) {
    r1 = c;
    g1 = x;
  } else if (hh >= 1 && hh < 2) {
    r1 = x;
    g1 = c;
  } else if (hh >= 2 && hh < 3) {
    g1 = c;
    b1 = x;
  } else if (hh >= 3 && hh < 4) {
    g1 = x;
    b1 = c;
  } else if (hh >= 4 && hh < 5) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  const m = l - c / 2;

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number): string => {
    const hex = n.toString(16);
    return hex.length === 1 ? `0${hex}` : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hexToRgba(hex: string, alpha: number = 1): string {
  hex = hex.replace(/^#/, "");

  if (hex.length === 8) {
    const a = parseInt(hex.substring(6, 8), 16) / 255;
    alpha = a;
    hex = hex.substring(0, 6);
  }

  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("");
  }

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
