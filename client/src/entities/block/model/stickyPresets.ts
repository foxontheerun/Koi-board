export type StickyColorId =
  | "yellow"
  | "orange"
  | "pink"
  | "purple"
  | "blue"
  | "teal"
  | "green"
  | "lime"
  | "yellowStrong"
  | "orangeStrong"
  | "pinkStrong"
  | "purpleStrong"
  | "blueStrong"
  | "tealStrong"
  | "greenStrong"
  | "black";

export const STICKY_COLORS: StickyColorId[] = [
  "yellow",
  "orange",
  "pink",
  "purple",
  "blue",
  "teal",
  "green",
  "lime",

  "yellowStrong",
  "orangeStrong",
  "pinkStrong",
  "purpleStrong",
  "blueStrong",
  "tealStrong",
  "greenStrong",
  "black",
];
export const STICKY_PRESETS: Record<
  StickyColorId,
  { fill: string; stroke: string }
> = {
  // 🌼 пастельные
  yellow: {
    fill: "var(--color-sticky-yellow-fill, #FEF9C3)",
    stroke: "var(--color-sticky-yellow-stroke, #FDE047)",
  },
  orange: {
    fill: "var(--color-sticky-orange-fill, #FFE4C7)",
    stroke: "var(--color-sticky-orange-stroke, #FDBA74)",
  },
  pink: {
    fill: "var(--color-sticky-pink-fill, #FCE7F3)",
    stroke: "var(--color-sticky-pink-stroke, #F9A8D4)",
  },
  purple: {
    fill: "var(--color-sticky-purple-fill, #F3E8FF)",
    stroke: "var(--color-sticky-purple-stroke, #D8B4FE)",
  },
  blue: {
    fill: "var(--color-sticky-blue-fill, #DBEAFE)",
    stroke: "var(--color-sticky-blue-stroke, #93C5FD)",
  },
  teal: {
    fill: "var(--color-sticky-teal-fill, #CCFBF1)",
    stroke: "var(--color-sticky-teal-stroke, #5EEAD4)",
  },
  green: {
    fill: "var(--color-sticky-green-fill, #DCFCE7)",
    stroke: "var(--color-sticky-green-stroke, #86EFAC)",
  },
  lime: {
    fill: "var(--color-sticky-lime-fill, #ECFCCB)",
    stroke: "var(--color-sticky-lime-stroke, #A3E635)",
  },

  // 🌈 насыщенные (как второй столбец в Miro)
  yellowStrong: {
    fill: "var(--color-sticky-yellow-strong-fill, #FDE047)",
    stroke: "var(--color-sticky-yellow-strong-stroke, #FACC15)",
  },
  orangeStrong: {
    fill: "var(--color-sticky-orange-strong-fill, #FDBA74)",
    stroke: "var(--color-sticky-orange-strong-stroke, #FB923C)",
  },
  pinkStrong: {
    fill: "var(--color-sticky-pink-strong-fill, #F9A8D4)",
    stroke: "var(--color-sticky-pink-strong-stroke, #EC4899)",
  },
  purpleStrong: {
    fill: "var(--color-sticky-purple-strong-fill, #D8B4FE)",
    stroke: "var(--color-sticky-purple-strong-stroke, #A855F7)",
  },
  blueStrong: {
    fill: "var(--color-sticky-blue-strong-fill, #93C5FD)",
    stroke: "var(--color-sticky-blue-strong-stroke, #3B82F6)",
  },
  tealStrong: {
    fill: "var(--color-sticky-teal-strong-fill, #5EEAD4)",
    stroke: "var(--color-sticky-teal-strong-stroke, #14B8A6)",
  },
  greenStrong: {
    fill: "var(--color-sticky-green-strong-fill, #86EFAC)",
    stroke: "var(--color-sticky-green-strong-stroke, #22C55E)",
  },

  // ⚫ чёрный
  black: {
    fill: "#292929",
    stroke: "#111111",
  },
};
