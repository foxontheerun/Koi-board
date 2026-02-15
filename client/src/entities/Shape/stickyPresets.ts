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
  yellow: {
    fill: "#FEF9C3",
    stroke: "#FDE047",
  },
  orange: {
    fill: "#FFE4C7",
    stroke: "#FDBA74",
  },
  pink: {
    fill: "#FCE7F3",
    stroke: "#F9A8D4",
  },
  purple: {
    fill: "#F3E8FF",
    stroke: "#D8B4FE",
  },
  blue: {
    fill: "#DBEAFE",
    stroke: "#93C5FD",
  },
  teal: {
    fill: "#CCFBF1",
    stroke: "#5EEAD4",
  },
  green: {
    fill: "#DCFCE7",
    stroke: "#86EFAC",
  },
  lime: {
    fill: "#ECFCCB",
    stroke: "#A3E635",
  },

  yellowStrong: {
    fill: "#FDE047",
    stroke: "#FACC15",
  },
  orangeStrong: {
    fill: "#FDBA74",
    stroke: "#FB923C",
  },
  pinkStrong: {
    fill: "#F9A8D4",
    stroke: "#EC4899",
  },
  purpleStrong: {
    fill: "#D8B4FE",
    stroke: "#A855F7",
  },
  blueStrong: {
    fill: "#93C5FD",
    stroke: "#3B82F6",
  },
  tealStrong: {
    fill: "#5EEAD4",
    stroke: "#14B8A6",
  },
  greenStrong: {
    fill: "#86EFAC",
    stroke: "#22C55E",
  },

  black: {
    fill: "#292929",
    stroke: "#111111",
  },
};
