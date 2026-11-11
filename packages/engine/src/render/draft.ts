import type { Map as MapLibreMap } from "maplibre-gl";
import type { XY } from "../geo.ts";
import { headLength, headWings, placeHead, smoothLine } from "../ink.ts";

/**
 * A canvas over the map for the stroke or arrow being drawn, so inking has no
 * delay. The map doesn't move while drawing, so screen space is enough. It
 * draws the same way the finished line is drawn.
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

  draw(points: readonly XY[], width: number, color: string, arrow: boolean) {
    const ctx = this.context;
    this.clear();
    const path = smoothLine(points);
    if (path.length === 0) return;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    path.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    if (path.length === 1) ctx.lineTo(path[0]![0], path[0]![1]);
    ctx.stroke();
    const head = arrow ? placeHead(path, headLength(width)) : null;
    if (head) {
      const [a, b] = headWings(head, headLength(width));
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(head.at[0], head.at[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
  }

  clear() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  destroy() {
    this.map.off("resize", this.resize);
    this.canvas.remove();
  }

  private resize = () => {
    const { clientWidth, clientHeight } = this.map.getContainer();
    const ratio = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(clientWidth * ratio);
    this.canvas.height = Math.round(clientHeight * ratio);
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
  };
}
