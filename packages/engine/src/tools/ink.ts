import { dist, polylineLength, roundCoord, SCALE_RANGE, zoomScale } from "../geo.ts";
import { uid } from "../id.ts";
import type { InkXY } from "../ink.ts";
import { inkColor, STROKE_SIZE } from "../palette.ts";
import type { InkPoint, LineElement } from "../types.ts";
import type { ScreenPoint, Tool, ToolContext } from "./context.ts";

/** How close (px) a line's end must be to a marker or post-it to snap. */
const SNAP_MARGIN = { stroke: 6, arrow: 18 };

/**
 * Freehand drawing. Arrows are drawn the same way, with a head where the pointer
 * lifts. One pointer draws; a second one cancels for pinch-zoom.
 */
export function createInkTool(ctx: ToolContext, kind: "stroke" | "arrow"): Tool {
  let pointer: number | null = null;
  let points: InkXY[] = [];
  let from: string | null = null;
  let to: string | null = null;

  const snapAt = (p: ScreenPoint) => {
    const rect = ctx.map.getContainer().getBoundingClientRect();
    return ctx.points.hitTest(rect.left + p.x, rect.top + p.y, SNAP_MARGIN[kind]);
  };

  const render = () => {
    const prefs = ctx.state.$prefs.get();
    const path = points.map(([x, y]): [number, number] => [x, y]);
    const scale = zoomScale(ctx.map.getZoom(), SCALE_RANGE.line);
    ctx.draft.draw(path, STROKE_SIZE[prefs.width], scale, inkColor(prefs.ink).hex, kind === "arrow");
  };

  const reset = () => {
    pointer = null;
    points = [];
    from = null;
    to = null;
    ctx.draft.clear();
    ctx.points.setSnapTarget(null);
  };

  const toInk = (event: PointerEvent, p: ScreenPoint): InkXY =>
    event.pointerType === "pen" ? [p.x, p.y, event.pressure] : [p.x, p.y];

  const finish = () => {
    const board = ctx.board();
    const first = points[0];
    const last = points[points.length - 1];
    if (!board || !first || !last) return reset();
    // A tap draws a dot, but an arrow needs some length to point anywhere.
    if (kind === "arrow" && polylineLength(points.map(([x, y]) => [x, y])) < 10) return reset();
    const prefs = ctx.state.$prefs.get();
    const stored: InkPoint[] = points.map(([x, y, pressure]) => {
      const { lng, lat } = ctx.map.unproject([x, y]);
      return pressure === undefined
        ? [roundCoord(lng), roundCoord(lat)]
        : [roundCoord(lng), roundCoord(lat), Math.round(pressure * 100) / 100];
    });
    const element: LineElement = {
      id: uid(),
      kind,
      order: board.nextOrder(),
      refZoom: ctx.map.getZoom(),
      points: stored,
      color: prefs.ink,
      width: prefs.width,
    };
    if (from) element.from = from;
    if (to && to !== from) element.to = to;
    board.add(element);
    reset();
  };

  return {
    pointerDown(event, p) {
      if (pointer !== null) {
        // A second finger: this is a pinch, not a stroke.
        reset();
        return;
      }
      if (event.pointerType === "mouse" && event.button !== 0) return;
      pointer = event.pointerId;
      points = [toInk(event, p)];
      from = snapAt(p);
      ctx.points.setSnapTarget(from);
      render();
    },
    pointerMove(event, p) {
      if (event.pointerId !== pointer) return;
      const rect = ctx.map.getContainer().getBoundingClientRect();
      const samples = event.getCoalescedEvents?.() ?? [];
      for (const sample of samples.length > 0 ? samples : [event]) {
        const q = { x: sample.clientX - rect.left, y: sample.clientY - rect.top };
        const prev = points[points.length - 1]!;
        if (dist([prev[0], prev[1]], [q.x, q.y]) >= 1.5) points.push(toInk(sample, q));
      }
      to = snapAt(p);
      ctx.points.setSnapTarget(to ?? from);
      render();
    },
    pointerUp(event) {
      if (event.pointerId === pointer) finish();
    },
    cancel: reset,
    deactivate: reset,
  };
}
