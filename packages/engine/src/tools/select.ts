import type { MapMouseEvent, MapTouchEvent } from "maplibre-gl";
import { add, fromMerc, roundCoord, sub, toMerc, type XY } from "../geo.ts";
import { isLine, type InkPoint } from "../types.ts";
import type { Tool, ToolContext } from "./context.ts";

const fromPointElement = (event: MapMouseEvent | MapTouchEvent) =>
  (event.originalEvent.target as Element | null)?.closest?.(".em-point") != null;

/**
 * Pans the map, selects elements and moves them. Markers, post-its and pins
 * are dragged by MapLibre's Marker; lines are dragged here.
 */
export function createSelectTool(ctx: ToolContext): Tool {
  let drag: { id: string; start: XY; startX: number; startY: number; offset: XY | null } | null = null;

  const lineAt = (x: number, y: number) => ctx.lines.hitTest(x, y, 6)[0] ?? null;

  const onClick = (event: MapMouseEvent) => {
    if (fromPointElement(event)) return;
    ctx.select(lineAt(event.point.x, event.point.y));
  };

  // Double-clicking a line edits its label instead of zooming.
  const onDoubleClick = (event: MapMouseEvent) => {
    if (fromPointElement(event)) return;
    const id = lineAt(event.point.x, event.point.y);
    if (!id) return;
    event.preventDefault();
    ctx.select(id);
    ctx.editLabel(id);
  };

  const onDown = (event: MapMouseEvent | MapTouchEvent) => {
    if (fromPointElement(event)) return;
    if ("points" in event && event.points.length !== 1) return;
    if (event.originalEvent instanceof MouseEvent && event.originalEvent.button !== 0) return;
    const id = lineAt(event.point.x, event.point.y);
    if (!id) return;
    // Grabbing a line moves it instead of panning the map.
    event.preventDefault();
    ctx.select(id);
    const client = "touches" in event.originalEvent ? event.originalEvent.touches[0] : event.originalEvent;
    drag = {
      id,
      start: toMerc([event.lngLat.lng, event.lngLat.lat]),
      startX: client?.clientX ?? 0,
      startY: client?.clientY ?? 0,
      offset: null,
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  };

  const onMove = (event: PointerEvent) => {
    if (!drag) return;
    if (!drag.offset && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 3) return;
    const rect = ctx.map.getContainer().getBoundingClientRect();
    const { lng, lat } = ctx.map.unproject([event.clientX - rect.left, event.clientY - rect.top]);
    drag.offset = sub(toMerc([lng, lat]), drag.start);
    ctx.scene.overrides.set(drag.id, { offset: drag.offset });
    ctx.preview([drag.id]);
  };

  const stopListening = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
  };

  const onUp = () => {
    stopListening();
    const current = drag;
    drag = null;
    if (!current?.offset) return;
    const offset = current.offset;
    const line = ctx.scene.elements.get(current.id);
    ctx.scene.overrides.delete(current.id);
    if (!line || !isLine(line)) return;
    const points: InkPoint[] = line.points.map((p) => {
      const [lng, lat] = fromMerc(add(toMerc(p), offset));
      return p[2] === undefined
        ? [roundCoord(lng), roundCoord(lat)]
        : [roundCoord(lng), roundCoord(lat), p[2]];
    });
    ctx.board()?.update(current.id, { points });
  };

  const onCancel = () => {
    stopListening();
    if (drag) {
      ctx.scene.overrides.delete(drag.id);
      ctx.preview([drag.id]);
    }
    drag = null;
  };

  return {
    activate() {
      ctx.map.on("click", onClick);
      ctx.map.on("dblclick", onDoubleClick);
      ctx.map.on("mousedown", onDown);
      ctx.map.on("touchstart", onDown);
    },
    deactivate() {
      ctx.map.off("click", onClick);
      ctx.map.off("dblclick", onDoubleClick);
      ctx.map.off("mousedown", onDown);
      ctx.map.off("touchstart", onDown);
      onCancel();
    },
  };
}
