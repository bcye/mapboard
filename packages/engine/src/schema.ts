import type { BoardElement, Label, LabelStyle, Width } from "./types.ts";

const LABEL_STYLES: LabelStyle[] = ["plain", "box", "note"];
const WIDTHS: Width[] = ["s", "m", "l"];

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";

const isLngLat = (v: unknown) =>
  Array.isArray(v) &&
  v.length >= 2 &&
  isNum(v[0]) &&
  isNum(v[1]) &&
  Math.abs(v[1]) <= 90 &&
  (v.length === 2 || isNum(v[2]));

const isSize = (v: unknown) => Array.isArray(v) && v.length === 2 && v.every((n) => isNum(n) && n > 0);

function isLabel(v: unknown): v is Label {
  return isObj(v) && isStr(v.text) && LABEL_STYLES.includes(v.style as LabelStyle);
}

/**
 * Checks an element read from a board or a file. Unknown fields are kept, so
 * data written by newer versions survives a round trip. Returns null for
 * anything this version can't draw.
 */
export function parseElement(value: unknown): BoardElement | null {
  if (!isObj(value)) return null;
  if (!isStr(value.id) || value.id === "" || !isStr(value.order) || !isNum(value.refZoom)) {
    return null;
  }
  if (value.label !== undefined && !isLabel(value.label)) return null;
  switch (value.kind) {
    case "stroke":
    case "arrow": {
      const points = value.points;
      if (!Array.isArray(points) || points.length === 0 || !points.every(isLngLat)) return null;
      if (!isStr(value.color) || !WIDTHS.includes(value.width as Width)) return null;
      if (value.from !== undefined && !isStr(value.from)) return null;
      if (value.to !== undefined && !isStr(value.to)) return null;
      return value as unknown as BoardElement;
    }
    case "marker":
      return isLngLat(value.at) && isStr(value.color) ? (value as unknown as BoardElement) : null;
    case "note":
      return isLngLat(value.at) &&
        isStr(value.text) &&
        isStr(value.color) &&
        (value.size === undefined || isSize(value.size))
        ? (value as unknown as BoardElement)
        : null;
    case "pin":
      return isLngLat(value.at) && isStr(value.boardId) && isStr(value.color)
        ? (value as unknown as BoardElement)
        : null;
    default:
      return null;
  }
}
