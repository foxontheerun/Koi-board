import type { ColorPickerOption } from "../../features/color-picker/ui/ColorPicker";

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
  // 🌤 SOFT (чистые, «бумажные»)
  yellow: {
    fill: "#FFF7CC",
    stroke: "#FACC15",
  },
  orange: {
    fill: "#FFEAD9",
    stroke: "#F97316",
  },
  pink: {
    fill: "#FFE6F0",
    stroke: "#EC4899",
  },
  purple: {
    fill: "#F1E8FF",
    stroke: "#8B5CF6",
  },
  blue: {
    fill: "#E6F0FF",
    stroke: "#3B82F6",
  },
  teal: {
    fill: "#E6FAF7",
    stroke: "#14B8A6",
  },
  green: {
    fill: "#E6F9ED",
    stroke: "#22C55E",
  },
  lime: {
    fill: "#F2FFCC",
    stroke: "#84CC16",
  },

  // 🔥 STRONG (та же hue, но насыщеннее)
  yellowStrong: {
    fill: "#FFE066",
    stroke: "#EAB308",
  },
  orangeStrong: {
    fill: "#FFB47A",
    stroke: "#EA580C",
  },
  pinkStrong: {
    fill: "#FF99C8",
    stroke: "#DB2777",
  },
  purpleStrong: {
    fill: "#C4A5FF",
    stroke: "#7C3AED",
  },
  blueStrong: {
    fill: "#7FB3FF",
    stroke: "#2563EB",
  },
  tealStrong: {
    fill: "#5EEAD4",
    stroke: "#0D9488",
  },
  greenStrong: {
    fill: "#6EE7B7",
    stroke: "#16A34A",
  },

  black: {
    fill: "#2B2B2B",
    stroke: "#111111",
  },
};

export const SHAPE_COLORS = [
  {
    id: "blue",
    fill: "#CFE0FF",
    stroke: "#3B6BDB",
    label: "Blue",
  },
  {
    id: "green",
    fill: "#D6F5E8",
    stroke: "#2F9E6D",
    label: "Green",
  },
  {
    id: "pink",
    fill: "#FFD6E7",
    stroke: "#D94F8A",
    label: "Pink",
  },
  {
    id: "purple",
    fill: "#E4DAFF",
    stroke: "#7A5AF8",
    label: "Purple",
  },
  {
    id: "orange",
    fill: "#FFE2CC",
    stroke: "#E07A2F",
    label: "Orange",
  },
  {
    id: "yellow",
    fill: "#FFF1A8",
    stroke: "#D4A700",
    label: "Yellow",
  },
  {
    id: "teal",
    fill: "#CFF5EE",
    stroke: "#2AA198",
    label: "Teal",
  },

  // 👇 новые более «природные»
  {
    id: "olive",
    fill: "#E6F0C2",
    stroke: "#8A9A2F",
    label: "Olive",
  },
  {
    id: "sand",
    fill: "#F3E7C9",
    stroke: "#C2A96A",
    label: "Sand",
  },
  {
    id: "brown",
    fill: "#D2A679",
    stroke: "#8B5A2B",
    label: "Brown",
  },

  // 👇 чуть более «y2k / насыщенные»
  {
    id: "sky",
    fill: "#B7D4FF",
    stroke: "#2563EB",
    label: "Sky",
  },
  {
    id: "mint",
    fill: "#BFF3D8",
    stroke: "#22C55E",
    label: "Mint",
  },
  {
    id: "rose",
    fill: "#FFB3C7",
    stroke: "#E11D48",
    label: "Rose",
  },
  {
    id: "violet",
    fill: "#C4B5FD",
    stroke: "#6D28D9",
    label: "Violet",
  },

  {
    id: "slate",
    fill: "#E5E7EB",
    stroke: "#475569",
    label: "Slate",
  },
  {
    id: "charcoal",
    fill: "#3A3A3A",
    stroke: "#111111",
    label: "Charcoal",
  },
] as const satisfies ColorPickerOption[];
