import { Marker, type Map as MapLibreMap } from "maplibre-gl";
import { fromMerc, SCALE_RANGE, worldSize, zoomScale, type XY } from "../geo.ts";
import { HEAD_ANGLE, headLength, placeHead, smoothLine } from "../ink.ts";
import { inkColor, SELECTION_HEX, STROKE_SIZE } from "../palette.ts";
import type { Scene } from "../scene.ts";

/** Space between an arrowhead and the element it points at, in px. */
const GAP = 3;
/** Extra width of the selection outline, in px (as for lines). */
const HALO = 7;

interface Head {
  id: string;
  marker: Marker;
  root: HTMLElement;
  /** Rotated and scaled around the tip. */
  turn: HTMLElement;
  halo: SVGPathElement | null;
  refZoom: number;
  width: number;
  /** The drawn line in Mercator space. */
  path: XY[];
  to?: string;
  /** Color and width the SVG was built for. */
  key: string;
  /** Position and transform last written, to skip unchanged writes. */
  placed: string;
}

/**
 * Arrowheads as MapLibre DOM Markers, so they scale like the line and stay at
 * the edge of a snapped post-it or pin, whose size relative to the map changes
 * with zoom.
 */
export class ArrowHeads {
  private heads = new Map<string, Head>();
  private selected: string | null = null;
  private erasing = new Set<string>();

  private map: MapLibreMap;
  private scene: Scene;

  constructor(map: MapLibreMap, scene: Scene) {
    this.map = map;
    this.scene = scene;
  }

  /** Redraws heads of these ids (anything that isn't an arrow is ignored). */
  update(ids: Iterable<string>) {
    const zoom = this.map.getZoom();
    for (const id of ids) {
      const element = this.scene.elements.get(id);
      if (!element || element.kind !== "arrow") {
        this.remove(id);
        continue;
      }
      const head = this.heads.get(id) ?? this.create(id);
      head.refZoom = element.refZoom;
      head.width = STROKE_SIZE[element.width];
      head.path = smoothLine(this.scene.linePath(element));
      head.to = element.to;
      const key = `${element.color}:${element.width}`;
      if (head.key !== key) {
        head.key = key;
        this.build(head, inkColor(element.color).hex);
      }
      head.root.style.zIndex = String(this.scene.rank(id));
      head.placed = "";
      this.place(head, zoom);
    }
  }

  rescale(zoom: number) {
    for (const head of this.heads.values()) this.place(head, zoom);
  }

  clear() {
    for (const head of this.heads.values()) head.marker.remove();
    this.heads.clear();
    this.selected = null;
    this.erasing.clear();
  }

  setSelected(id: string | null) {
    this.selected = id;
    for (const head of this.heads.values()) this.paintState(head);
  }

  setErasing(ids: Set<string>) {
    this.erasing = new Set(ids);
    for (const head of this.heads.values()) this.paintState(head);
  }

  private create(id: string): Head {
    const root = document.createElement("div");
    root.className = "em-head";
    const turn = document.createElement("div");
    turn.className = "absolute top-0 left-0 origin-top-left";
    root.append(turn);
    const marker = new Marker({ element: root, anchor: "center", subpixelPositioning: true });
    marker.setLngLat([0, 0]).addTo(this.map);
    const head: Head = {
      id,
      marker,
      root,
      turn,
      halo: null,
      refZoom: 0,
      width: 0,
      path: [],
      key: "",
      placed: "",
    };
    this.heads.set(id, head);
    return head;
  }

  private remove(id: string) {
    this.heads.get(id)?.marker.remove();
    this.heads.delete(id);
  }

  /** An SVG chevron with its tip at the origin, pointing along +x. */
  private build(head: Head, color: string) {
    const width = head.width;
    const length = headLength(width);
    const back = length * Math.cos(HEAD_ANGLE);
    const spread = length * Math.sin(HEAD_ANGLE);
    const pad = width / 2 + HALO;
    const box = { x: -back - pad, y: -spread - pad, w: back + 2 * pad, h: 2 * spread + 2 * pad };
    // The stem repeats the line's end, so the selection outline doesn't cover it.
    const d = `M${-back} ${-spread}L0 0L${-back} ${spread}M0 0L${-back} 0`;
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", `${box.x} ${box.y} ${box.w} ${box.h}`);
    svg.setAttribute("width", String(box.w));
    svg.setAttribute("height", String(box.h));
    svg.style.cssText = `position:absolute;left:${box.x}px;top:${box.y}px;overflow:visible`;
    const path = (stroke: string) => {
      const node = document.createElementNS(ns, "path");
      node.setAttribute("d", d);
      node.setAttribute("fill", "none");
      node.setAttribute("stroke", stroke);
      node.setAttribute("stroke-width", String(width));
      node.setAttribute("stroke-linecap", "round");
      node.setAttribute("stroke-linejoin", "round");
      return node;
    };
    const halo = path(SELECTION_HEX);
    svg.append(halo, path(color));
    head.halo = halo;
    head.turn.replaceChildren(svg);
    this.paintState(head);
  }

  /**
   * A free arrow's head only changes size with zoom; a snapped one also moves
   * along the line, as the element it points at changes size relative to the map.
   */
  private place(head: Head, zoom: number) {
    const scale = zoomScale(zoom, head.refZoom, SCALE_RANGE.line);
    const box = head.to ? (this.scene.snapBox(head.to, zoom, GAP) ?? undefined) : undefined;
    // Aim using the head's length at the reference zoom, so the angle doesn't change with zoom.
    const placed = placeHead(head.path, headLength(head.width) / worldSize(head.refZoom), box);
    const key = placed ? `${placed.at.join()}:${placed.direction.join()}:${scale}` : "none";
    if (key === head.placed) return;
    head.placed = key;
    head.root.hidden = !placed;
    if (!placed) return;
    head.marker.setLngLat(fromMerc(placed.at));
    const angle = Math.atan2(placed.direction[1], placed.direction[0]);
    head.turn.style.transform = `rotate(${angle}rad) scale(${scale})`;
    head.halo?.setAttribute("stroke-width", String(head.width + HALO / scale));
  }

  private paintState(head: Head) {
    head.halo?.setAttribute("stroke-opacity", head.id === this.selected ? "0.85" : "0");
    head.turn.style.opacity = this.erasing.has(head.id) ? "0.25" : "";
  }
}
