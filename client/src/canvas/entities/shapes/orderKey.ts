const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export const FIRST_KEY = "V";

export function keyBetween(
  before: string | null,
  after: string | null,
): string {
  if (before !== null && after !== null && before >= after) {
    throw new Error(`order keys out of order: ${before} >= ${after}`);
  }
  return midpoint(before ?? "", after);
}

export function keysBetween(
  before: string | null,
  after: string | null,
  count: number,
): string[] {
  const keys: string[] = [];
  let low = before;
  for (let i = 0; i < count; i++) {
    low = keyBetween(low, after);
    keys.push(low);
  }
  return keys;
}

export function compareKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isValidKey(key: string): boolean {
  if (key === "" || key.endsWith("0")) return false;
  return [...key].every((c) => DIGITS.includes(c));
}

// A key is read as the fractional part of a base-62 number, so "V" is roughly
// a half and any two keys have a key between them. Trailing "0" is disallowed:
// it would be a second spelling of the same value, and midpoint could then be
// asked for a point between a value and itself.
function midpoint(low: string, high: string | null): string {
  if (high !== null) {
    let shared = 0;
    while ((low[shared] ?? "0") === high[shared]) shared++;
    if (shared > 0) {
      return (
        high.slice(0, shared) + midpoint(low.slice(shared), high.slice(shared))
      );
    }
  }

  const lowDigit = low === "" ? 0 : DIGITS.indexOf(low[0]);
  const highDigit = high !== null && high !== "" ? DIGITS.indexOf(high[0]) : DIGITS.length;

  if (highDigit - lowDigit > 1) {
    return DIGITS[Math.round((lowDigit + highDigit) / 2)];
  }
  if (high !== null && high.length > 1) {
    return high.slice(0, 1);
  }
  return DIGITS[lowDigit] + midpoint(low.slice(1), null);
}
