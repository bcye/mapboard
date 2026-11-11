import { describe, expect, it } from "vite-plus/test";
import { BASE_ZOOM, fromMerc, SCALE_RANGE, toMerc, worldSize, zoomScale, type XY } from "../src/geo.ts";
import { bendEnd, placeHead, smoothLine } from "../src/ink.ts";
import { Scene } from "../src/scene.ts";
import type { BoardElement, LineElement, MarkerElement, NoteElement } from "../src/types.ts";

const straight = (n: number): XY[] => Array.from({ length: n + 1 }, (_, i) => [i, 0]);

describe("geometry", () => {
  it("converts to Web Mercator and back", () => {
    const [lng, lat] = fromMerc(toMerc([13.405, 52.52]));
    expect(lng).toBeCloseTo(13.405, 9);
    expect(lat).toBeCloseTo(52.52, 9);
    expect(toMerc([0, 0])).toEqual([0.5, 0.5]);
  });

  it("scales elements with the zoom only, at half the map's rate, within their range", () => {
    expect(zoomScale(BASE_ZOOM, SCALE_RANGE.note)).toBe(1);
    expect(zoomScale(BASE_ZOOM + 1, SCALE_RANGE.line)).toBeCloseTo(Math.SQRT2);
    expect(zoomScale(BASE_ZOOM - 1, SCALE_RANGE.note)).toBeCloseTo(Math.SQRT1_2);
    expect(zoomScale(16, SCALE_RANGE.note)).toBe(1.25);
    expect(zoomScale(0, SCALE_RANGE.note)).toBe(0.4);
  });

  it("smooths a line but keeps its ends", () => {
    const line: XY[] = [
      [0, 0],
      [10, 4],
      [20, -4],
      [30, 4],
      [40, 0],
    ];
    const smooth = smoothLine(line);
    expect(smooth[0]).toEqual([0, 0]);
    expect(smooth.at(-1)).toEqual([40, 0]);
    expect(Math.max(...smooth.map(([, y]) => Math.abs(y)))).toBeLessThan(4);
  });

  it("puts an arrowhead at the tip, pointing along the last stretch", () => {
    const head = placeHead(straight(100), 20)!;
    expect(head.at).toEqual([100, 0]);
    expect(head.direction).toEqual([1, 0]);
  });

  it("puts an arrowhead where the line enters a box", () => {
    const box = { center: [100, 0] as XY, halfWidth: 10, halfHeight: 5 };
    const head = placeHead(straight(100), 20, box)!;
    expect(head.at[0]).toBeCloseTo(90, 5);
    expect(head.at[1]).toBeCloseTo(0, 5);
    expect(head.direction).toEqual([1, 0]);
    expect(
      placeHead(
        straight(5).map(([x]) => [x + 98, 0]),
        20,
        box,
      ),
    ).toBeNull();
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
    expect(path.at(-1)).toEqual(toMerc([10, 3]));
    expect(path[0]).toEqual(toMerc([0, 0]));
  });

  it("sizes a post-it's snap box for the zoom, whatever zoom it was drawn at", () => {
    const note: NoteElement = {
      id: "n",
      kind: "note",
      order: "a2",
      refZoom: 9,
      at: [0, 0],
      text: "",
      color: "amber",
    };
    const { scene } = sceneWith(note);
    scene.sizeOf = () => ({ width: 100, height: 60 });
    const atBase = scene.snapBox("n", BASE_ZOOM, 0)!;
    expect(atBase.halfWidth * worldSize(BASE_ZOOM)).toBeCloseTo(50);
    // Two zoom levels in, the map is four times as big, the post-it only 1.25 times (its limit).
    const zoomedIn = scene.snapBox("n", BASE_ZOOM + 2, 0)!;
    expect(zoomedIn.halfWidth * worldSize(BASE_ZOOM + 2)).toBeCloseTo(50 * 1.25);
  });

  it("stacks by order", () => {
    const { scene } = sceneWith(marker, arrow);
    expect(scene.rank("l")).toBeLessThan(scene.rank("m"));
  });
});
