type ColorOperation = "lighten" | "darken";

export function adjustHexBrightness(
  color: string,
  percent: number,
  operation: ColorOperation = "lighten",
): string {
  // ✅ Обрабатываем разные форматы цветов
  let hex = color.trim();

  // Если цвет в формате #rrggbbaa или #rrggbb
  if (hex.startsWith("#")) {
    hex = hex.substring(1);

    // Если есть альфа-канал (#rrggbbaa) - убираем его
    if (hex.length === 8) {
      hex = hex.substring(0, 6);
    }

    // Если короткий формат (#rgb) - расширяем до #rrggbb
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((char) => char + char)
        .join("");
    }
  }
  // Если формат rgba() или rgb()
  else if (hex.startsWith("rgb")) {
    const match = hex.match(/\d+/g);
    if (!match || match.length < 3) return color; // Не можем распарсить - возвращаем как есть

    const r = parseInt(match[0]);
    const g = parseInt(match[1]);
    const b = parseInt(match[2]);

    return rgbToHex(
      adjustChannel(r, percent, operation),
      adjustChannel(g, percent, operation),
      adjustChannel(b, percent, operation),
    );
  }
  // Если непонятный формат - возвращаем как есть
  else {
    console.warn(`Unsupported color format: ${color}`);
    return color;
  }

  // Парсим hex
  if (hex.length !== 6) {
    console.warn(`Invalid hex color: ${color}`);
    return color;
  }

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    console.warn(`Failed to parse hex color: ${color}`);
    return color;
  }

  percent = Math.min(100, Math.max(0, percent));

  const newR = adjustChannel(r, percent, operation);
  const newG = adjustChannel(g, percent, operation);
  const newB = adjustChannel(b, percent, operation);

  return rgbToHex(newR, newG, newB);
}

function adjustChannel(
  value: number,
  percent: number,
  operation: ColorOperation,
): number {
  const factor =
    operation === "lighten" ? 1 + percent / 100 : 1 - percent / 100;
  return Math.min(255, Math.max(0, Math.round(value * factor)));
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number): string => {
    const hex = n.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
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
