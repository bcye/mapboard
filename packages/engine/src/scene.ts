import {
  add,
  fromMerc,
  pointAlong,
  polylineLength,
  SCALE_RANGE,
  toMerc,
  worldSize,
  zoomScale,
  type ScaleRange,
  type XY,
} from "./geo.ts";
import { bendEnd, type SnapShape } from "./ink.ts";
import {
  isLine,
  isPoint,
  type BoardElement,
  type ElementKind,
  type LineElement,
  type LngLat,
} from "./types.ts";

/** Unscaled DOM size of a point element, in px at its reference zoom. */
export type SizeOf = (id: string) => { width: number; height: number } | null;

/** Temporary positions while something is being dragged. Not saved. */
export type Override = { at: LngLat } | { offset: XY };

const FALLBACK_SIZE = { note: { width: 144, height: 72 } };

/** How far elements of this kind grow and shrink with zoom. */
export const scaleRangeFor = (kind: ElementKind | "line-label"): ScaleRange =>
  kind === "note"
    ? SCALE_RANGE.note
    : kind === "stroke" || kind === "arrow"
      ? SCALE_RANGE.line
      : SCALE_RANGE.point;

/**
 * The board as currently drawn: elements, stacking order, which lines are
 * snapped to which points, and drag previews. Both renderers read from here.
 */
export class Scene {
  readonly elements = new Map<string, BoardElement>();
  readonly overrides = new Map<string, Override>();
  /** Point element id → ids of lines snapped to it. */
  private attached = new Map<string, Set<string>>();
  private ranks = new Map<string, number>();
  sizeOf: SizeOf = () => null;

  clear() {
    this.elements.clear();
    this.overrides.clear();
    this.attached.clear();
    this.ranks.clear();
  }

  /**
   * Applies changed elements and returns every id whose drawing is affected,
   * including lines snapped to a changed point.
   */
  apply(ids: Iterable<string>, read: (id: string) => BoardElement | undefined): Set<string> {
    const affected = new Set<string>();
    for (const id of ids) {
      const previous = this.elements.get(id);
      if (previous && isLine(previous)) this.detach(previous);
      const next = read(id);
      if (next) {
        this.elements.set(id, next);
        if (isLine(next)) this.attach(next);
      } else {
        this.elements.delete(id);
      }
      affected.add(id);
      for (const line of this.attached.get(id) ?? []) affected.add(line);
    }
    this.rerank();
    return affected;
  }

  /** Ids of lines whose drawing depends on this point element. */
  linesAttachedTo(id: string): Set<string> {
    return this.attached.get(id) ?? new Set();
  }

  rank(id: string): number {
    return this.ranks.get(id) ?? 0;
  }

  /** Current position of a point element, including a drag preview. */
  positionOf(id: string): LngLat | null {
    const override = this.overrides.get(id);
    if (override && "at" in override) return override.at;
    const element = this.elements.get(id);
    return element && isPoint(element) ? element.at : null;
  }

  /**
   * The line in Mercator space, with drag offsets and snapped ends applied.
   * Snapped ends go to the point's position (a post-it's centre, a
   * marker's tip), so the path doesn't depend on zoom. The element covers the
   * rest of the line.
   */
  linePath(line: LineElement): XY[] {
    const override = this.overrides.get(line.id);
    const offset = override && "offset" in override ? override.offset : null;
    let path = line.points.map((p) => (offset ? add(toMerc(p), offset) : toMerc(p)));
    if (line.from && line.from !== line.to) {
      const target = this.positionOf(line.from);
      if (target) path = bendEnd(path, toMerc(target), "start");
    }
    if (line.to) {
      const target = this.positionOf(line.to);
      if (target) path = bendEnd(path, toMerc(target), "end");
    }
    return path;
  }

  /** Where a label sits on a line: halfway along it. */
  lineMidpoint(line: LineElement): LngLat {
    const path = this.linePath(line);
    return fromMerc(pointAlong(path, polylineLength(path) / 2));
  }

  /**
   * The box a point element covers on screen at `zoom`, plus `gap` px around
   * it, in Mercator units. For a marker, just the gap around its tip.
   */
  snapBox(pointId: string, zoom: number, gap: number): SnapShape | null {
    const element = this.elements.get(pointId);
    const at = this.positionOf(pointId);
    if (!element || !at || !isPoint(element)) return null;
    const unit = 1 / worldSize(zoom);
    const center = toMerc(at);
    if (element.kind === "marker") return { center, halfWidth: gap * unit, halfHeight: gap * unit };
    const size = this.sizeOf(pointId) ?? FALLBACK_SIZE[element.kind];
    const scale = zoomScale(zoom, scaleRangeFor(element.kind));
    return {
      center,
      halfWidth: ((size.width / 2) * scale + gap) * unit,
      halfHeight: ((size.height / 2) * scale + gap) * unit,
    };
  }

  private attach(line: LineElement) {
    for (const id of [line.from, line.to]) {
      if (!id) continue;
      let set = this.attached.get(id);
      if (!set) this.attached.set(id, (set = new Set()));
      set.add(line.id);
    }
  }

  private detach(line: LineElement) {
    for (const id of [line.from, line.to]) {
      if (id) this.attached.get(id)?.delete(line.id);
    }
  }

  private rerank() {
    const sorted = [...this.elements.values()].sort((a, b) =>
      a.order < b.order ? -1 : a.order > b.order ? 1 : a.id < b.id ? -1 : 1,
    );
    this.ranks = new Map(sorted.map((element, index) => [element.id, index]));
  }
}
