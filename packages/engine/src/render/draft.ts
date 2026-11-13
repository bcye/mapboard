import type { Map as MapLibreMap } from "maplibre-gl";
import type { XY } from "../geo.ts";
import { headLength, headWings, placeHead, smoothLine } from "../ink.ts";

interface Stroke {
  points: readonly XY[];
  width: number;
  scale: number;
  color: string;
  arrow: boolean;
}

/**
 * A canvas over the map for the stroke or arrow being drawn, so inking has no
 * delay. The map doesn't move while drawing, so screen space is enough. It
 * draws the same way the finished line is drawn.
 */
export class DraftLayer {
  private canvas = document.createElement("canvas");
  private context = this.canvas.getContext("2d")!;
  private current: Stroke | null = null;
  /** Finished strokes, kept until the map draws their line. */
  private held = new Set<Stroke>();

  private map: MapLibreMap;

  constructor(map: MapLibreMap) {
    this.map = map;
    this.canvas.className = "em-draft";
    map.getContainer().append(this.canvas);
    map.on("resize", this.resize);
    map.on("movestart", this.release);
    this.resize();
  }

  /** `width` is the base width, drawn at `scale` like finished lines. */
  draw(points: readonly XY[], width: number, scale: number, color: string, arrow: boolean) {
    this.current = { points, width, scale, color, arrow };
    this.paint();
  }

  /**
   * Keeps the current stroke on screen until `until` settles, so it doesn't
   * blink out before the map has drawn the finished line.
   */
  hold(until: Promise<void>) {
    const stroke = this.current;
    this.current = null;
    if (!stroke) return;
    this.held.add(stroke);
    void until.finally(() => {
      if (this.held.delete(stroke)) this.paint();
    });
  }

  /** Removes the current stroke. Held ones stay until their line is drawn. */
  clear() {
    this.current = null;
    this.paint();
  }

  destroy() {
    this.map.off("resize", this.resize);
    this.map.off("movestart", this.release);
    this.canvas.remove();
  }

  private paint() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const stroke of this.held) this.stroke(stroke);
    if (this.current) this.stroke(this.current);
  }

  private stroke({ points, width, scale, color, arrow }: Stroke) {
    const ctx = this.context;
    const path = smoothLine(points);
    if (path.length === 0) return;
    const length = headLength(width) * scale;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width * scale;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    path.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    if (path.length === 1) ctx.lineTo(path[0]![0], path[0]![1]);
    ctx.stroke();
    const head = arrow ? placeHead(path, length) : null;
    if (head) {
      const [a, b] = headWings(head, length);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(head.at[0], head.at[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
  }

  /** Held strokes are in screen space, so they can't follow the map. */
  private release = () => {
    if (this.held.size === 0) return;
    this.held.clear();
    this.paint();
  };

  private resize = () => {
    const { clientWidth, clientHeight } = this.map.getContainer();
    const ratio = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(clientWidth * ratio);
    this.canvas.height = Math.round(clientHeight * ratio);
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.paint();
  };
}
