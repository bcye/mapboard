/** `[lng, lat]` in degrees. */
export type LngLat = [lng: number, lat: number];

/** A drawn input point. Pressure is only stored for pen input. */
export type InkPoint = [lng: number, lat: number, pressure?: number];

export type LabelStyle = "plain" | "box";

export interface Label {
  text: string;
  style: LabelStyle;
}

export type Width = "s" | "m" | "l";

interface Base {
  id: string;
  /** Sortable string for stacking (fractional index). */
  order: string;
  /** Map zoom when the element was created. Not used for its size, see `zoomScale`. */
  refZoom: number;
  /** Shown on markers and lines. */
  label?: Label;
}

export interface LineElement extends Base {
  kind: "stroke" | "arrow";
  points: InkPoint[];
  color: string;
  width: Width;
  /** Id of the marker or note the start is snapped to. */
  from?: string;
  /** Id of the marker or note the end is snapped to. */
  to?: string;
}

export interface MarkerElement extends Base {
  kind: "marker";
  at: LngLat;
  color: string;
  /** Board this marker links to. Its label is then that board's name. */
  boardId?: string;
}

export interface NoteElement extends Base {
  kind: "note";
  at: LngLat;
  text: string;
  color: string;
  /**
   * Size set by resizing, in px at base size. The height is a minimum:
   * the post-it still grows to fit its text. Unset means the default size.
   */
  size?: [width: number, height: number];
}

export type PointElement = MarkerElement | NoteElement;
export type BoardElement = LineElement | PointElement;
export type ElementKind = BoardElement["kind"];

export const isLine = (el: BoardElement): el is LineElement => el.kind === "stroke" || el.kind === "arrow";

export const isPoint = (el: BoardElement): el is PointElement => !isLine(el);

export type ToolId = "select" | "draw" | "arrow" | "marker" | "note" | "eraser";
