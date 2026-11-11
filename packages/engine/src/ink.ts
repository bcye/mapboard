import { add, dist, len, normalize, pointAlong, polylineLength, scale, sub, type XY } from "./geo.ts";

/** A point with optional pen pressure, in px space. */
export type InkXY = [x: number, y: number, pressure?: number];

/** How far each point is pulled toward the next input point (1 = no smoothing). */
const STREAMLINE = 0.7;

/**
 * Smooths a drawn line for display: each point eases toward the input, then
 * corners are rounded (one Chaikin pass). Both ends stay where they were.
 */
export function smoothLine(points: readonly XY[]): XY[] {
  if (points.length < 3) return points.slice();
  const eased: XY[] = [points[0]!];
  for (let i = 1; i < points.length; i++) {
    const prev = eased[eased.length - 1]!;
    const next = points[i]!;
    const point: XY =
      i === points.length - 1
        ? next
        : [prev[0] + (next[0] - prev[0]) * STREAMLINE, prev[1] + (next[1] - prev[1]) * STREAMLINE];
    if (point[0] !== prev[0] || point[1] !== prev[1]) eased.push(point);
  }
  if (eased.length < 3) return eased;
  const out: XY[] = [eased[0]!];
  for (let i = 1; i < eased.length; i++) {
    const a = eased[i - 1]!;
    const b = eased[i]!;
    if (i > 1) out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
    if (i < eased.length - 1) out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
  }
  out.push(eased[eased.length - 1]!);
  return out;
}

/** Half the angle between an arrowhead's two strokes, in radians. */
export const HEAD_ANGLE = 0.5;

/** Length of an arrowhead's strokes for a line `width` px wide. */
export const headLength = (width: number) => width * 2.2 + 8;

/** Where an arrowhead sits and which way it points (a unit vector). */
export interface HeadPlacement {
  at: XY;
  direction: XY;
}

/** Where a line's end sits inside: a box around a post-it, or a small one around a marker's tip. */
export interface SnapShape {
  center: XY;
  halfWidth: number;
  halfHeight: number;
}

const inside = (p: XY, box: SnapShape) =>
  Math.abs(p[0] - box.center[0]) < box.halfWidth && Math.abs(p[1] - box.center[1]) < box.halfHeight;

/**
 * The head of an arrow drawn along `path`, with strokes `length` long. With a
 * `box`, the head sits where the line enters it, so it isn't hidden under the
 * element the line is snapped to. Null if there's nowhere to put it.
 */
export function placeHead(path: readonly XY[], length: number, box?: SnapShape): HeadPlacement | null {
  let line = path;
  if (box) {
    let last = path.length - 1;
    while (last >= 0 && inside(path[last]!, box)) last--;
    if (last < 0) return null;
    line = path.slice(0, last + 1);
    const outer = path[last]!;
    const inner = path[last + 1];
    if (inner) {
      // Binary search along the segment for the box edge.
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        const p: XY = [outer[0] + (inner[0] - outer[0]) * mid, outer[1] + (inner[1] - outer[1]) * mid];
        if (inside(p, box)) hi = mid;
        else lo = mid;
      }
      line = [...line, [outer[0] + (inner[0] - outer[0]) * lo, outer[1] + (inner[1] - outer[1]) * lo]];
    }
  }
  const tip = line[line.length - 1];
  if (!tip) return null;
  // Aim along the last stretch of the line, not its final wobble.
  const total = polylineLength(line as XY[]);
  const back = pointAlong(line as XY[], Math.max(0, total - length * 0.75));
  const direction = normalize(sub(tip, back));
  if (direction[0] === 0 && direction[1] === 0) return null;
  return { at: tip, direction };
}

/** End points of an arrowhead's two strokes, which meet at `head.at`. */
export function headWings(head: HeadPlacement, length: number): [XY, XY] {
  const wing = (angle: number): XY => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const [dx, dy] = [-head.direction[0], -head.direction[1]];
    return add(head.at, scale([dx * cos - dy * sin, dx * sin + dy * cos], length));
  };
  return [wing(HEAD_ANGLE), wing(-HEAD_ANGLE)];
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
