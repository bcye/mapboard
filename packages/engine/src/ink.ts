import { getStroke, type StrokeOptions } from "perfect-freehand";
import { add, dist, len, normalize, pointAlong, polylineLength, scale, sub, type XY } from "./geo.ts";

/** A point with optional pen pressure, in px space. */
export type InkXY = [x: number, y: number, pressure?: number];

const strokeOptions = (size: number, pen: boolean): StrokeOptions => ({
  size,
  thinning: 0.55,
  smoothing: 0.5,
  streamline: 0.35,
  simulatePressure: !pen,
  last: true,
});

const arrowOptions = (size: number): StrokeOptions => ({
  size,
  thinning: 0.1,
  smoothing: 0.6,
  streamline: 0.2,
  simulatePressure: false,
  last: true,
});

/** Closed outline ring for a freehand stroke. Works in any px space. */
export function strokeOutline(points: InkXY[], size: number): XY[] {
  const pen = points.some((p) => p[2] !== undefined);
  const input = points.map((p) => [p[0], p[1], p[2] ?? 0.5]);
  return closeRing(getStroke(input, strokeOptions(size, pen)));
}

/** Outline rings for an arrow: the shaft plus the two strokes of the head. */
export function arrowOutlines(points: XY[], size: number): XY[][] {
  if (points.length < 2) return [];
  const total = polylineLength(points);
  if (total === 0) return [];
  const tip = points[points.length - 1]!;
  const headLength = Math.min(Math.max(size * 3.2, 14), total * 0.45);
  const back = pointAlong(points, Math.max(0, total - headLength));
  const direction = normalize(sub(tip, back));
  const wing = (angle: number): XY => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const d: XY = [-direction[0], -direction[1]];
    return add(tip, scale([d[0] * cos - d[1] * sin, d[0] * sin + d[1] * cos], headLength));
  };
  const withPressure = (pts: XY[]) => pts.map((p) => [p[0], p[1], 0.5]);
  const shaft = closeRing(getStroke(withPressure(points), arrowOptions(size)));
  const head = [wing(0.5), wing(-0.5)].map((end) =>
    closeRing(getStroke(withPressure([end, tip]), arrowOptions(size))),
  );
  return [shaft, ...head];
}

function closeRing(points: number[][]): XY[] {
  const ring = points.map((p) => [p[0]!, p[1]!] as XY);
  if (ring.length > 0) ring.push([ring[0]![0], ring[0]![1]]);
  return ring;
}

const smoothstep = (x: number) => x * x * (3 - 2 * x);

/**
 * Moves one end of a line onto `target` and lets only the last part of the line
 * follow, fading out along the line. The rest keeps its hand-drawn shape.
 */
export function bendEnd(points: XY[], target: XY, end: "start" | "end"): XY[] {
  if (points.length === 0) return points;
  const pts = end === "start" ? points.slice() : points.slice().reverse();
  const delta = sub(target, pts[0]!);
  const shift = len(delta);
  if (shift === 0) return points;
  const total = polylineLength(pts);
  const reach = total === 0 ? 0 : Math.min(total * 0.6, Math.max(total * 0.2, shift * 3));
  const out: XY[] = [add(pts[0]!, delta)];
  let travelled = 0;
  for (let i = 1; i < pts.length; i++) {
    travelled += dist(pts[i - 1]!, pts[i]!);
    const weight = reach === 0 ? 1 : travelled >= reach ? 0 : smoothstep(1 - travelled / reach);
    out.push(add(pts[i]!, scale(delta, weight)));
  }
  return end === "start" ? out : out.reverse();
}

/** Where a line should stop when it ends at a shape centred on `center`. */
export interface SnapShape {
  center: XY;
  /** Half width and height of the shape's box. 0 for a point. */
  halfWidth: number;
  halfHeight: number;
}

/**
 * The point where a line approaching from `from` should end, just outside the
 * shape's box, so an arrowhead isn't hidden under the element.
 */
export function snapPoint(shape: SnapShape, from: XY, margin: number): XY {
  const direction = normalize(sub(shape.center, from));
  const [dx, dy] = direction;
  if (dx === 0 && dy === 0) return shape.center;
  const tx = dx === 0 ? Infinity : shape.halfWidth / Math.abs(dx);
  const ty = dy === 0 ? Infinity : shape.halfHeight / Math.abs(dy);
  const inset = Math.min(tx, ty) + margin;
  return sub(shape.center, scale(direction, inset));
}

/** The point on the line used to judge where it approaches its end from. */
export function approachPoint(points: XY[], end: "start" | "end"): XY {
  const pts = end === "start" ? points : points.slice().reverse();
  const total = polylineLength(pts);
  return pointAlong(pts, Math.min(total * 0.25, total));
}
