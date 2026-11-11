/**
 * Colors come from Tailwind's default palette. Map layers can't read Tailwind's
 * CSS variables (oklch), so `hex` holds the sRGB equivalent of the same shade.
 * DOM elements use the class names so they render the exact theme color.
 * Elements store the palette `key`; unknown keys fall back to the first entry.
 */
export interface PaletteColor {
  key: string;
  name: string;
  hex: string;
  /** Background class, e.g. for swatches and note paper. */
  bg: string;
  /** Text/fill class, for SVG `currentColor`. */
  text: string;
  /** Darker shade for text in this color, e.g. labels. */
  dark: string;
}

export const INK: PaletteColor[] = [
  {
    key: "ink",
    name: "Ink",
    hex: "#292524",
    bg: "bg-stone-800",
    text: "text-stone-800",
    dark: "text-stone-800",
  },
  {
    key: "rose",
    name: "Rose",
    hex: "#ff2056",
    bg: "bg-rose-500",
    text: "text-rose-500",
    dark: "text-rose-700",
  },
  {
    key: "orange",
    name: "Sunset",
    hex: "#ff6900",
    bg: "bg-orange-500",
    text: "text-orange-500",
    dark: "text-orange-700",
  },
  {
    key: "emerald",
    name: "Forest",
    hex: "#009966",
    bg: "bg-emerald-600",
    text: "text-emerald-600",
    dark: "text-emerald-800",
  },
  { key: "sky", name: "Ocean", hex: "#00a6f4", bg: "bg-sky-500", text: "text-sky-500", dark: "text-sky-700" },
  {
    key: "violet",
    name: "Lavender",
    hex: "#8e51ff",
    bg: "bg-violet-500",
    text: "text-violet-500",
    dark: "text-violet-700",
  },
];

export const PAPER: PaletteColor[] = [
  {
    key: "amber",
    name: "Sun",
    hex: "#fee685",
    bg: "bg-amber-200",
    text: "text-amber-200",
    dark: "text-amber-800",
  },
  {
    key: "rose",
    name: "Blossom",
    hex: "#ffccd3",
    bg: "bg-rose-200",
    text: "text-rose-200",
    dark: "text-rose-800",
  },
  {
    key: "sky",
    name: "Lagoon",
    hex: "#b8e6fe",
    bg: "bg-sky-200",
    text: "text-sky-200",
    dark: "text-sky-800",
  },
  {
    key: "lime",
    name: "Palm",
    hex: "#d8f999",
    bg: "bg-lime-200",
    text: "text-lime-200",
    dark: "text-lime-800",
  },
  {
    key: "orange",
    name: "Peach",
    hex: "#ffd6a7",
    bg: "bg-orange-200",
    text: "text-orange-200",
    dark: "text-orange-800",
  },
  {
    key: "violet",
    name: "Lilac",
    hex: "#ddd6ff",
    bg: "bg-violet-200",
    text: "text-violet-200",
    dark: "text-violet-800",
  },
];

/** Selection highlight on the map (teal-400). */
export const SELECTION_HEX = "#00d5be";

export function inkColor(key: string | undefined): PaletteColor {
  return INK.find((c) => c.key === key) ?? INK[0]!;
}

export function paperColor(key: string | undefined): PaletteColor {
  return PAPER.find((c) => c.key === key) ?? PAPER[0]!;
}

/** Line widths in px at the element's reference zoom. */
export const STROKE_SIZE = { s: 2, m: 3, l: 5 } as const;
