import type { Map as MapLibreMap } from "maplibre-gl";
import type { Board } from "../board.ts";
import type { DraftLayer } from "../render/draft.ts";
import type { LinesRenderer } from "../render/lines.ts";
import type { PointsRenderer } from "../render/points.ts";
import type { Scene } from "../scene.ts";
import type { UiState } from "../state.ts";
import type { ToolId } from "../types.ts";

/** What tools get to work with. */
export interface ToolContext {
  map: MapLibreMap;
  state: UiState;
  scene: Scene;
  points: PointsRenderer;
  lines: LinesRenderer;
  draft: DraftLayer;
  board(): Board | null;
  select(id: string | null): void;
  setTool(tool: ToolId): void;
  /** Redraws ids that depend on a drag preview in the scene. */
  preview(ids: Iterable<string>): void;
}

/** Pointer position relative to the map container. */
export interface ScreenPoint {
  x: number;
  y: number;
}

export interface Tool {
  activate?(): void;
  deactivate?(): void;
  pointerDown?(event: PointerEvent, at: ScreenPoint): void;
  pointerMove?(event: PointerEvent, at: ScreenPoint): void;
  pointerUp?(event: PointerEvent, at: ScreenPoint): void;
  /** The gesture was interrupted, e.g. a second finger started a pinch. */
  cancel?(): void;
}
