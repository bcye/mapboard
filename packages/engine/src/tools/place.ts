import type { MapMouseEvent } from "maplibre-gl";
import { createBoardMeta } from "../boards.ts";
import { roundCoord } from "../geo.ts";
import { uid } from "../id.ts";
import type { LngLat } from "../types.ts";
import type { Tool, ToolContext } from "./context.ts";

/**
 * Places a marker, post-it or board pin where the map is tapped. The map still
 * pans, so you can move around before placing. Markers stay armed for the next
 * stop; post-its and pins switch back to select.
 */
export function createPlaceTool(ctx: ToolContext, kind: "marker" | "note" | "pin"): Tool {
  const onClick = (event: MapMouseEvent) => {
    const board = ctx.board();
    if (!board) return;
    const prefs = ctx.state.$prefs.get();
    const at: LngLat = [roundCoord(event.lngLat.lng), roundCoord(event.lngLat.lat)];
    const base = { id: uid(), order: board.nextOrder(), refZoom: ctx.map.getZoom(), at };
    if (kind === "marker") {
      board.add({ ...base, kind, color: prefs.ink });
      return;
    }
    if (kind === "note") {
      board.add({ ...base, kind, text: "", color: prefs.paper });
      ctx.setTool("select");
      ctx.select(base.id);
      ctx.points.editNote(base.id);
      return;
    }
    const target = ctx.state.$pinTarget.get();
    const boardId = target === "new" ? createBoardMeta(ctx.state.$pinName.get()).id : target;
    ctx.state.$pinName.set("");
    board.add({ ...base, kind, boardId, color: prefs.ink });
    ctx.setTool("select");
    ctx.select(base.id);
  };

  return {
    activate: () => ctx.map.on("click", onClick),
    deactivate: () => ctx.map.off("click", onClick),
  };
}
