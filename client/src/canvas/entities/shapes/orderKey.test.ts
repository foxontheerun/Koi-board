import { describe, it, expect } from "vitest";
import {
  keyBetween,
  keysBetween,
  isValidKey,
  FIRST_KEY,
} from "./orderKey";

describe("orderKey", () => {
  it("puts the first key in the middle of the space", () => {
    const first = keyBetween(null, null);
    expect(first).toBe(FIRST_KEY);
    expect(keyBetween(null, first) < first).toBe(true);
    expect(keyBetween(first, null) > first).toBe(true);
  });

  it("returns a key strictly between its neighbours", () => {
    const a = keyBetween(null, null);
    const b = keyBetween(a, null);
    const mid = keyBetween(a, b);
    expect(a < mid).toBe(true);
    expect(mid < b).toBe(true);
  });

  it("keeps working when the same gap is used over and over", () => {
    let low = keyBetween(null, null);
    const high = keyBetween(low, null);

    for (let i = 0; i < 200; i++) {
      const next = keyBetween(low, high);
      expect(low < next).toBe(true);
      expect(next < high).toBe(true);
      expect(isValidKey(next)).toBe(true);
      low = next;
    }
  });

  it("appends without ever colliding", () => {
    const keys: string[] = [];
    let last: string | null = null;
    for (let i = 0; i < 500; i++) {
      last = keyBetween(last, null);
      keys.push(last);
    }
    expect([...keys].sort()).toEqual(keys);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("prepends without ever colliding", () => {
    const keys: string[] = [];
    let first: string | null = null;
    for (let i = 0; i < 500; i++) {
      first = keyBetween(null, first);
      keys.unshift(first);
    }
    expect([...keys].sort()).toEqual(keys);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("hands out a run of keys in order", () => {
    const a = keyBetween(null, null);
    const b = keyBetween(a, null);
    const run = keysBetween(a, b, 5);

    expect(run).toHaveLength(5);
    expect([...run].sort()).toEqual(run);
    expect(a < run[0]).toBe(true);
    expect(run[4] < b).toBe(true);
  });

  it("refuses neighbours that are out of order", () => {
    const a = keyBetween(null, null);
    const b = keyBetween(a, null);
    expect(() => keyBetween(b, a)).toThrow();
    expect(() => keyBetween(a, a)).toThrow();
  });

  it("sorts as text, which is how the database will sort it", () => {
    const keys = [
      keyBetween(null, null),
      keyBetween("V", null),
      keyBetween(null, "V"),
    ];
    const byText = [...keys].sort();
    expect(byText[0] < byText[1]).toBe(true);
    expect(byText[1] < byText[2]).toBe(true);
  });

  it("accepts the keys the backfill migration writes", () => {
    expect(isValidKey("000001V")).toBe(true);
    expect(keyBetween("000001V", "000002V") > "000001V").toBe(true);
    expect(keyBetween("000001V", "000002V") < "000002V").toBe(true);
  });

  it("rejects keys that are empty or end in zero", () => {
    expect(isValidKey("")).toBe(false);
    expect(isValidKey("V0")).toBe(false);
    expect(isValidKey("V-")).toBe(false);
    expect(isValidKey("V")).toBe(true);
  });
});
