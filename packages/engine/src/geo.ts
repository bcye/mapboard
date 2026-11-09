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

/** Scale of an element drawn at `refZoom` when the map is at `zoom`. */
export const zoomScale = (zoom: number, refZoom: number) => 2 ** (zoom - refZoom);

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

/**
 * A gentle arc from `a` to `b`, sampled into points, like a flight route.
 * `bend` is the control point's offset as a fraction of the distance; the arc
 * always bulges "up" (towards smaller y), which reads well on a north-up map.
 */
export function arcPoints(a: XY, b: XY, bend: number, samples = 32): XY[] {
  const d = sub(b, a);
  const length = len(d);
  if (length === 0 || bend === 0) return [a, b];
  let normal: XY = [d[1] / length, -d[0] / length];
  if (normal[1] > 0) normal = scale(normal, -1);
  const control = add(scale(add(a, b), 0.5), scale(normal, length * bend));
  const out: XY[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const u = 1 - t;
    out.push([
      u * u * a[0] + 2 * u * t * control[0] + t * t * b[0],
      u * u * a[1] + 2 * u * t * control[1] + t * t * b[1],
    ]);
  }
  return out;
}

/** Rounds coordinates for storage (7 decimals is ~1 cm). */
export const roundCoord = (value: number) => Math.round(value * 1e7) / 1e7;
