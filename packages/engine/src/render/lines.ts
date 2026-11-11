import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import type {
  DataDrivenPropertyValueSpecification,
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
} from "maplibre-gl";
import { fromMerc, polylineLength, SCALE_RANGE, worldSize, type XY } from "../geo.ts";
import { smoothLine } from "../ink.ts";
import { inkColor, SELECTION_HEX, STROKE_SIZE } from "../palette.ts";
import type { Scene } from "../scene.ts";
import type { LineElement } from "../types.ts";
import { ArrowHeads } from "./heads.ts";

export const LINES_SOURCE = "em-lines";
const LINES_LAYER = "em-lines";
const LINES_HALO_LAYER = "em-lines-halo";
const DOTS_LAYER = "em-dots";
const HIT_LAYERS = [LINES_LAYER, DOTS_LAYER];

/** Extra width of the selection outline, in px. */
const HALO = 7;

interface LineProps {
  id: string;
  color: string;
  rank: number;
  /** Width in px at the reference zoom. */
  width: number;
  refZoom: number;
}

type LineFeature = Feature<LineString | Point, LineProps>;

/**
 * `value(scale)` at every integer zoom, where `scale` is the line's zoom scale
 * there (see `zoomScale`). MapLibre interpolates between the stops on the GPU,
 * with the same √2 per zoom level, so widths change smoothly.
 */
function byZoomScale(
  value: (scale: ExpressionSpecification) => ExpressionSpecification,
): DataDrivenPropertyValueSpecification<number> {
  const [min, max] = SCALE_RANGE.line;
  const stops = Array.from({ length: 25 }, (_, zoom) => [
    zoom,
    value(["max", min, ["min", max, ["^", 2, ["/", ["-", zoom, ["get", "refZoom"]], 2]]]]),
  ]);
  return ["interpolate", ["exponential", Math.SQRT2], ["zoom"], ...stops.flat()] as ExpressionSpecification;
}

const selected: ExpressionSpecification = ["boolean", ["feature-state", "selected"], false];
const erasing: ExpressionSpecification = ["boolean", ["feature-state", "erasing"], false];

/** A stroke or arrow as a smoothed line, in lng/lat. Very short strokes are dots. */
export function lineFeature(line: LineElement, scene: Scene): LineFeature {
  const size = worldSize(line.refZoom);
  // Work in px at the element's reference zoom.
  const path = scene.linePath(line).map(([x, y]): XY => [x * size, y * size]);
  const toLngLat = ([x, y]: XY) => fromMerc([x / size, y / size]);
  const properties: LineProps = {
    id: line.id,
    color: inkColor(line.color).hex,
    rank: scene.rank(line.id),
    width: STROKE_SIZE[line.width],
    refZoom: line.refZoom,
  };
  const geometry: LineString | Point =
    path.length < 2 || polylineLength(path) < 1
      ? { type: "Point", coordinates: toLngLat(path[0] ?? [0, 0]) }
      : { type: "LineString", coordinates: smoothLine(path).map(toLngLat) };
  return { type: "Feature", properties, geometry };
}

/**
 * Draws strokes and arrows as lines in a MapLibre GeoJSON source, with
 * arrowheads as DOM Markers. Their width scales with zoom like the other
 * elements, not with the map.
 */
export class LinesRenderer {
  private heads: ArrowHeads;
  private features = new Map<string, LineFeature>();
  private pending = new Map<string, LineFeature | null>();
  private frame = 0;
  private selected: string | null = null;
  private erasing = new Set<string>();

  private map: MapLibreMap;
  private scene: Scene;

  constructor(map: MapLibreMap, scene: Scene) {
    this.map = map;
    this.scene = scene;
    this.heads = new ArrowHeads(map, scene);
  }

  /** Adds the source and layers. Called again after every style change. */
  install() {
    if (this.map.getSource(LINES_SOURCE)) return;
    this.map.addSource(LINES_SOURCE, {
      type: "geojson",
      data: this.collection(),
      promoteId: "id",
      tolerance: 0.15,
      maxzoom: 20,
    });
    const isLine: ExpressionSpecification = ["==", ["geometry-type"], "LineString"];
    this.map.addLayer({
      id: LINES_HALO_LAYER,
      type: "line",
      source: LINES_SOURCE,
      filter: isLine,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": SELECTION_HEX,
        "line-width": byZoomScale((scale) => ["+", ["*", ["get", "width"], scale], HALO]),
        "line-opacity": ["case", selected, 0.85, 0],
      },
    });
    this.map.addLayer({
      id: LINES_LAYER,
      type: "line",
      source: LINES_SOURCE,
      filter: isLine,
      layout: { "line-join": "round", "line-cap": "round", "line-sort-key": ["get", "rank"] },
      paint: {
        "line-color": ["get", "color"],
        "line-width": byZoomScale((scale) => ["*", ["get", "width"], scale]),
        "line-opacity": ["case", erasing, 0.25, 1],
      },
    });
    this.map.addLayer({
      id: DOTS_LAYER,
      type: "circle",
      source: LINES_SOURCE,
      filter: ["==", ["geometry-type"], "Point"],
      layout: { "circle-sort-key": ["get", "rank"] },
      paint: {
        "circle-color": ["get", "color"],
        "circle-radius": byZoomScale((scale) => ["*", ["/", ["get", "width"], 2], scale]),
        "circle-opacity": ["case", erasing, 0.25, 1],
        "circle-stroke-color": SELECTION_HEX,
        "circle-stroke-width": HALO / 2,
        "circle-stroke-opacity": ["case", selected, 0.85, 0],
      },
    });
    this.applyStates();
  }

  /** Redraws these lines (ids of points are ignored). */
  update(ids: Iterable<string>) {
    const list = [...ids];
    this.heads.update(list);
    for (const id of list) {
      const element = this.scene.elements.get(id);
      if (element && (element.kind === "stroke" || element.kind === "arrow")) {
        this.pending.set(id, lineFeature(element, this.scene));
      } else if (this.features.has(id) || this.pending.has(id)) {
        this.pending.set(id, null);
      }
    }
    if (this.pending.size > 0 && !this.frame) {
      this.frame = requestAnimationFrame(() => this.flush());
    }
  }

  /** Moves arrowheads for the new zoom. Line widths follow on the GPU. */
  rescale(zoom: number) {
    this.heads.rescale(zoom);
  }

  clear() {
    this.heads.clear();
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.pending.clear();
    this.features.clear();
    this.selected = null;
    this.erasing.clear();
    void this.source()?.setData(this.collection());
  }

  setSelected(id: string | null) {
    this.heads.setSelected(id);
    if (this.selected) this.setState(this.selected, { selected: false });
    this.selected = id;
    if (id) this.setState(id, { selected: true });
  }

  setErasing(ids: Set<string>) {
    this.heads.setErasing(ids);
    for (const id of this.erasing) if (!ids.has(id)) this.setState(id, { erasing: false });
    for (const id of ids) this.setState(id, { erasing: true });
    this.erasing = new Set(ids);
  }

  /** Line ids under a screen point, topmost first. */
  hitTest(x: number, y: number, radius: number): string[] {
    const layers = HIT_LAYERS.filter((id) => this.map.getLayer(id));
    if (layers.length === 0) return [];
    const hits = this.map.queryRenderedFeatures(
      [
        [x - radius, y - radius],
        [x + radius, y + radius],
      ],
      { layers },
    );
    const ids = [...new Set(hits.map((f) => String(f.properties.id)))];
    return ids.sort((a, b) => this.scene.rank(b) - this.scene.rank(a));
  }

  private flush() {
    this.frame = 0;
    const add: LineFeature[] = [];
    const remove: string[] = [];
    for (const [id, feature] of this.pending) {
      if (feature) {
        this.features.set(id, feature);
        add.push(feature);
      } else {
        this.features.delete(id);
        remove.push(id);
      }
    }
    this.pending.clear();
    const source = this.source();
    if (!source) return;
    // `add` replaces features with the same id.
    void source.updateData({ add, remove });
  }

  private source() {
    return this.map.getSource<GeoJSONSource>(LINES_SOURCE);
  }

  private collection(): FeatureCollection {
    return { type: "FeatureCollection", features: [...this.features.values()] };
  }

  private setState(id: string, state: Record<string, boolean>) {
    if (this.source()) this.map.setFeatureState({ source: LINES_SOURCE, id }, state);
  }

  private applyStates() {
    if (this.selected) this.setState(this.selected, { selected: true });
    for (const id of this.erasing) this.setState(id, { erasing: true });
  }
}
