// Flat text plus formats over ranges, the shape Quill calls a Delta and Yjs
// stores natively - chosen so collaborative editing can be added later without
// rewriting how text is stored. Segments, which is what the painter wants, are
// derived from it rather than kept.

export interface TextAttributes {
  bold?: boolean;
  fontSize?: number;
  color?: string;
}

export interface TextFormat {
  index: number;
  length: number;
  attributes: TextAttributes;
}

export interface TextRange {
  index: number;
  length: number;
}

export interface TextSegment {
  text: string;
  attributes: TextAttributes;
}

export const MIXED = Symbol("mixed");

export type AttributeValue<T> = T | typeof MIXED | undefined;

export interface SelectionAttributes {
  bold: AttributeValue<boolean>;
  fontSize: AttributeValue<number>;
  color: AttributeValue<string>;
}

const ATTRIBUTE_KEYS = ["bold", "fontSize", "color"] as const;

function sameAttributes(a: TextAttributes, b: TextAttributes): boolean {
  return ATTRIBUTE_KEYS.every((key) => a[key] === b[key]);
}

function isEmpty(attributes: TextAttributes): boolean {
  return ATTRIBUTE_KEYS.every((key) => attributes[key] === undefined);
}

// Undefined means "not set here", so it must not overwrite what is below it.
function merge(base: TextAttributes, patch: TextAttributes): TextAttributes {
  const merged: TextAttributes = { ...base };

  for (const key of ATTRIBUTE_KEYS) {
    if (patch[key] !== undefined) {
      Object.assign(merged, { [key]: patch[key] });
    }
  }

  return merged;
}

function clampRange(range: TextRange, textLength: number): TextRange {
  const index = Math.max(0, Math.min(range.index, textLength));
  const length = Math.max(0, Math.min(range.length, textLength - index));
  return { index, length };
}

// Per character, so overlapping and out-of-order formats collapse to one answer
// without special cases. Text blocks are short enough for this to be free.
function attributesPerCharacter(
  textLength: number,
  formats: TextFormat[],
): TextAttributes[] {
  const perCharacter: TextAttributes[] = Array.from(
    { length: textLength },
    () => ({}),
  );

  for (const format of formats) {
    const { index, length } = clampRange(format, textLength);

    for (let at = index; at < index + length; at++) {
      perCharacter[at] = merge(perCharacter[at], format.attributes);
    }
  }

  return perCharacter;
}

function fromPerCharacter(perCharacter: TextAttributes[]): TextFormat[] {
  const formats: TextFormat[] = [];

  perCharacter.forEach((attributes, at) => {
    const last = formats[formats.length - 1];

    if (last && sameAttributes(last.attributes, attributes)) {
      last.length += 1;
      return;
    }

    formats.push({ index: at, length: 1, attributes });
  });

  return formats.filter((format) => !isEmpty(format.attributes));
}

export function segmentsFor(
  text: string,
  formats: TextFormat[] = [],
): TextSegment[] {
  if (!text) return [];

  const characters = Array.from(text);
  const perCharacter = attributesPerCharacter(characters.length, formats);
  const segments: TextSegment[] = [];

  characters.forEach((character, at) => {
    const last = segments[segments.length - 1];

    if (last && sameAttributes(last.attributes, perCharacter[at])) {
      last.text += character;
      return;
    }

    segments.push({ text: character, attributes: perCharacter[at] });
  });

  return segments;
}

export function applyFormat(
  formats: TextFormat[],
  range: TextRange,
  attributes: TextAttributes,
  textLength: number,
): TextFormat[] {
  const { index, length } = clampRange(range, textLength);
  if (length === 0) return formats;

  const perCharacter = attributesPerCharacter(textLength, formats);

  for (let at = index; at < index + length; at++) {
    perCharacter[at] = merge(perCharacter[at], attributes);
  }

  return fromPerCharacter(perCharacter);
}

export function attributesIn(
  formats: TextFormat[],
  range: TextRange,
  textLength: number,
): SelectionAttributes {
  const { index, length } = clampRange(range, textLength);
  const perCharacter = attributesPerCharacter(textLength, formats);
  const covered = length > 0 ? perCharacter.slice(index, index + length) : [];

  const read = <K extends keyof TextAttributes>(
    key: K,
  ): AttributeValue<NonNullable<TextAttributes[K]>> => {
    if (covered.length === 0) return undefined;

    const first = covered[0][key];
    const shared = covered.every((attributes) => attributes[key] === first);

    return shared
      ? (first as NonNullable<TextAttributes[K]> | undefined)
      : MIXED;
  };

  return {
    bold: read("bold"),
    fontSize: read("fontSize"),
    color: read("color"),
  };
}

function isFormat(value: unknown): value is TextFormat {
  const format = value as TextFormat;

  return (
    typeof format?.index === "number" &&
    typeof format?.length === "number" &&
    typeof format?.attributes === "object" &&
    format.attributes !== null
  );
}

// Formats travel as a JSON string. Anything unreadable is treated as unformatted
// rather than thrown: a board should still open if one shape carries nonsense.
export function parseFormats(raw?: string | null): TextFormat[] {
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isFormat) : [];
  } catch {
    return [];
  }
}

export function serializeFormats(formats: TextFormat[]): string | null {
  return formats.length > 0 ? JSON.stringify(formats) : null;
}
