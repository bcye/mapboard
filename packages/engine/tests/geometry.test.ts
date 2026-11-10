import { describe, expect, it } from "vite-plus/test";
import { dist, fromMerc, toMerc, type XY } from "../src/geo.ts";
import { arrowOutlines, bendEnd, snapPoint, strokeOutline, type InkXY } from "../src/ink.ts";
import { Scene } from "../src/scene.ts";
import type { BoardElement, LineElement, MarkerElement } from "../src/types.ts";

const straight = (n: number): XY[] => Array.from({ length: n + 1 }, (_, i) => [i, 0]);

describe("geometry", () => {
  it("converts to Web Mercator and back", () => {
    const [lng, lat] = fromMerc(toMerc([13.405, 52.52]));
    expect(lng).toBeCloseTo(13.405, 9);
    expect(lat).toBeCloseTo(52.52, 9);
    expect(toMerc([0, 0])).toEqual([0.5, 0.5]);
  });

  it("draws an arrow as the freehand line plus a head at its end", () => {
    const line: InkXY[] = [
      [0, 0],
      [20, 10],
      [40, 0],
      [60, 10],
      [100, 10],
    ];
    const [shaft, ...head] = arrowOutlines(line, 7);
    expect(shaft).toEqual(strokeOutline(line, 7));
    expect(head).toHaveLength(2);
    // The head points along the last stretch: its wings sit behind the tip.
    for (const ring of head) {
      expect(Math.min(...ring.map(([x]) => x))).toBeLessThan(95);
      expect(Math.max(...ring.map(([x]) => x))).toBeLessThanOrEqual(105);
    }
  });

  it("bends only the end of a line onto a target", () => {
    const line = straight(10);
    const bent = bendEnd(line, [10, 2], "end");
    expect(bent.at(-1)).toEqual([10, 2]);
    expect(bent[0]).toEqual([0, 0]);
    expect(bent.slice(0, 4)).toEqual(line.slice(0, 4));
    expect(bent).toHaveLength(line.length);

    const fromStart = bendEnd(line, [0, -3], "start");
    expect(fromStart[0]).toEqual([0, -3]);
    expect(fromStart.at(-1)).toEqual([10, 0]);
  });

  it("stops just outside a box", () => {
    const end = snapPoint({ center: [0, 0], halfWidth: 4, halfHeight: 2 }, [-10, 0], 1);
    expect(end[0]).toBeCloseTo(-5);
    expect(end[1]).toBeCloseTo(0);
  });
});

describe("scene", () => {
  const marker: MarkerElement = {
    id: "m",
    kind: "marker",
    order: "a1",
    refZoom: 4,
    at: [10, 0],
    color: "ink",
  };
  const arrow: LineElement = {
    id: "l",
    kind: "arrow",
    order: "a0",
    refZoom: 4,
    points: [
      [0, 0],
      [5, 0],
      [9.9, 0],
    ],
    color: "ink",
    width: "m",
    to: "m",
  };

  const sceneWith = (...elements: BoardElement[]) => {
    const scene = new Scene();
    const byId = new Map(elements.map((el) => [el.id, el]));
    scene.apply(byId.keys(), (id) => byId.get(id));
    return { scene, byId };
  };

  it("redraws lines snapped to a moved point", () => {
    const { scene, byId } = sceneWith(marker, arrow);
    byId.set("m", { ...marker, at: [10, 3] });
    expect(scene.apply(["m"], (id) => byId.get(id))).toEqual(new Set(["m", "l"]));
  });

  it("keeps a snapped end attached when the point moves, and the start in place", () => {
    const { scene } = sceneWith(marker, arrow);
    scene.overrides.set("m", { at: [10, 3] });
    const path = scene.linePath(arrow);
    // Ends 3px (at the marker's zoom) short of the tip, so an arrowhead stays visible.
    expect(dist(path.at(-1)!, toMerc([10, 3]))).toBeCloseTo(3 / (512 * 2 ** 4), 9);
    expect(path[0]).toEqual(toMerc([0, 0]));
  });

  it("stacks by order", () => {
    const { scene } = sceneWith(marker, arrow);
    expect(scene.rank("l")).toBeLessThan(scene.rank("m"));
  });
});
