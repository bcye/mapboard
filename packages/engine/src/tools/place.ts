import type { MapMouseEvent } from "maplibre-gl";
import { roundCoord } from "../geo.ts";
import { uid } from "../id.ts";
import type { LngLat } from "../types.ts";
import type { Tool, ToolContext } from "./context.ts";

/**
 * Places a marker or post-it where the map is tapped. The map still pans, so
 * you can move around before placing. Markers stay armed for the next stop;
 * post-its switch back to select.
 */
export function createPlaceTool(ctx: ToolContext, kind: "marker" | "note"): Tool {
  const onClick = (event: MapMouseEvent) => {
    const board = ctx.board();
    if (!board) return;
    const prefs = ctx.state.$prefs.get();
    const at: LngLat = [roundCoord(event.lngLat.lng), roundCoord(event.lngLat.lat)];
    const base = { id: uid(), order: board.nextOrder(), refZoom: ctx.map.getZoom(), at };
    if (kind === "marker") {
      board.add({ ...base, kind, color: prefs.ink });
    } else {
      board.add({ ...base, kind, text: "", color: prefs.paper });
      ctx.setTool("select");
      ctx.select(base.id);
      ctx.points.editNote(base.id);
    }
    ctx.state.$placed.set({ id: base.id, kind });
  };

  return {
    activate: () => ctx.map.on("click", onClick),
    deactivate: () => ctx.map.off("click", onClick),
  };
}
