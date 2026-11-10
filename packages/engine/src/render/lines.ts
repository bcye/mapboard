import type { Feature, FeatureCollection, MultiPolygon } from "geojson";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { fromMerc, worldSize } from "../geo.ts";
import { arrowOutlines, strokeOutline, type InkXY } from "../ink.ts";
import { inkColor, SELECTION_HEX, STROKE_SIZE } from "../palette.ts";
import type { Scene } from "../scene.ts";
import type { LineElement } from "../types.ts";

export const LINES_SOURCE = "em-lines";
export const LINES_FILL_LAYER = "em-lines-fill";
const LINES_HALO_LAYER = "em-lines-halo";

type LineFeature = Feature<MultiPolygon, { id: string; color: string; rank: number }>;

/** Builds the filled outline of a stroke or arrow, in lng/lat. */
export function lineFeature(line: LineElement, scene: Scene): LineFeature {
  const size = worldSize(line.refZoom);
  // Work in px at the element's reference zoom, so widths are in px.
  const path: InkXY[] = scene.linePath(line).map(([x, y], i) => {
    const pressure = line.points[i]?.[2];
    return pressure === undefined ? [x * size, y * size] : [x * size, y * size, pressure];
  });
  const width = STROKE_SIZE[line.width];
  const rings = line.kind === "arrow" ? arrowOutlines(path, width) : [strokeOutline(path, width)];
  const coordinates = rings
    .filter((ring) => ring.length >= 4)
    .map((ring) => [ring.map(([x, y]) => fromMerc([x / size, y / size]))]);
  return {
    type: "Feature",
    properties: { id: line.id, color: inkColor(line.color).hex, rank: scene.rank(line.id) },
    geometry: { type: "MultiPolygon", coordinates },
  };
}

/** Draws strokes and arrows as filled polygons in a MapLibre GeoJSON source. */
export class LinesRenderer {
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
    this.map.addLayer({
      id: LINES_HALO_LAYER,
      type: "line",
      source: LINES_SOURCE,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": SELECTION_HEX,
        "line-width": 7,
        "line-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 0.85, 0],
      },
    });
    this.map.addLayer({
      id: LINES_FILL_LAYER,
      type: "fill",
      source: LINES_SOURCE,
      layout: { "fill-sort-key": ["get", "rank"] },
      paint: {
        "fill-color": ["get", "color"],
        "fill-opacity": ["case", ["boolean", ["feature-state", "erasing"], false], 0.25, 1],
        "fill-antialias": true,
      },
    });
    this.applyStates();
  }

  /** Redraws these lines (ids of points are ignored). */
  update(ids: Iterable<string>) {
    for (const id of ids) {
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

  clear() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.pending.clear();
    this.features.clear();
    this.selected = null;
    this.erasing.clear();
    void this.source()?.setData(this.collection());
  }

  setSelected(id: string | null) {
    if (this.selected) this.setState(this.selected, { selected: false });
    this.selected = id;
    if (id) this.setState(id, { selected: true });
  }

  setErasing(ids: Set<string>) {
    for (const id of this.erasing) if (!ids.has(id)) this.setState(id, { erasing: false });
    for (const id of ids) this.setState(id, { erasing: true });
    this.erasing = new Set(ids);
  }

  /** Line ids under a screen point, topmost first. */
  hitTest(x: number, y: number, radius: number): string[] {
    if (!this.map.getLayer(LINES_FILL_LAYER)) return [];
    const hits = this.map.queryRenderedFeatures(
      [
        [x - radius, y - radius],
        [x + radius, y + radius],
      ],
      { layers: [LINES_FILL_LAYER] },
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
