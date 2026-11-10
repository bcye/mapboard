import type { Map as MapLibreMap } from "maplibre-gl";
import type { XY } from "../geo.ts";
import { arrowOutlines, strokeOutline, type InkXY } from "../ink.ts";

/**
 * A canvas over the map for the stroke or arrow being drawn, so inking has no
 * delay. The map doesn't move while drawing, so screen space is enough.
 */
export class DraftLayer {
  private canvas = document.createElement("canvas");
  private context = this.canvas.getContext("2d")!;

  private map: MapLibreMap;

  constructor(map: MapLibreMap) {
    this.map = map;
    this.canvas.className = "em-draft";
    map.getContainer().append(this.canvas);
    map.on("resize", this.resize);
    this.resize();
  }

  drawStroke(points: InkXY[], size: number, color: string) {
    this.fill([strokeOutline(points, size)], color);
  }

  drawArrow(points: InkXY[], size: number, color: string) {
    this.fill(arrowOutlines(points, size), color);
  }

  clear() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  destroy() {
    this.map.off("resize", this.resize);
    this.canvas.remove();
  }

  private fill(rings: XY[][], color: string) {
    const ctx = this.context;
    this.clear();
    ctx.fillStyle = color;
    ctx.beginPath();
    for (const ring of rings) {
      ring.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.closePath();
    }
    ctx.fill("nonzero");
  }

  private resize = () => {
    const { clientWidth, clientHeight } = this.map.getContainer();
    const ratio = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(clientWidth * ratio);
    this.canvas.height = Math.round(clientHeight * ratio);
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
  };
}
