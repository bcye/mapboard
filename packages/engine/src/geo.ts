import type { LngLat } from "./types.ts";

/** A 2D point in some planar space (Web Mercator 0..1 or pixels). */
export type XY = [x: number, y: number];

/** MapLibre's world size in px at zoom 0. */
export const TILE_SIZE = 512;

const MAX_LAT = 85.051129;

/** Web Mercator, normalized to 0..1 (same as MapLibre's MercatorCoordinate). */
export function toMerc(point: LngLat | readonly (number | undefined)[]): XY {
  const lng = point[0] ?? 0;
  const clamped = Math.max(-MAX_LAT, Math.min(MAX_LAT, point[1] ?? 0));
  const sin = Math.sin((clamped * Math.PI) / 180);
  return [(lng + 180) / 360, 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)];
}

export function fromMerc([x, y]: XY): LngLat {
  const lng = x * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
  return [lng, lat];
}

/** Size of one Mercator unit in px at `zoom`. */
export const worldSize = (zoom: number) => TILE_SIZE * 2 ** zoom;

/** Smallest and largest scale an element reaches, relative to its size at its reference zoom. */
export type ScaleRange = readonly [min: number, max: number];

/** How far each kind of element grows and shrinks with zoom. */
export const SCALE_RANGE = {
  note: [0.4, 1.25],
  /** Markers, board pins and line labels. */
  point: [0.7, 1.15],
  /** Line width and arrowheads. */
  line: [0.45, 1.6],
} as const satisfies Record<string, ScaleRange>;

/**
 * Scale of an element drawn at `refZoom` when the map is at `zoom`: it grows
 * and shrinks at half the map's rate (√2 per zoom level), within `range`.
 */
export const zoomScale = (zoom: number, refZoom: number, [min, max]: ScaleRange) =>
  Math.min(max, Math.max(min, 2 ** ((zoom - refZoom) / 2)));

export const sub = (a: XY, b: XY): XY => [a[0] - b[0], a[1] - b[1]];
export const add = (a: XY, b: XY): XY => [a[0] + b[0], a[1] + b[1]];
export const scale = (a: XY, s: number): XY => [a[0] * s, a[1] * s];
export const len = (a: XY) => Math.hypot(a[0], a[1]);
export const dist = (a: XY, b: XY) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function normalize(a: XY): XY {
  const l = len(a);
  return l === 0 ? [0, 0] : [a[0] / l, a[1] / l];
}

export function polylineLength(points: XY[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1]!, points[i]!);
  return total;
}

/** Point at `distance` along the polyline, measured from its start. */
export function pointAlong(points: XY[], distance: number): XY {
  if (points.length === 0) return [0, 0];
  let remaining = Math.max(0, distance);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const d = dist(a, b);
    if (remaining <= d && d > 0) {
      const t = remaining / d;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    remaining -= d;
  }
  return points[points.length - 1]!;
}

/** Rounds coordinates for storage (7 decimals is ~1 cm). */
export const roundCoord = (value: number) => Math.round(value * 1e7) / 1e7;
