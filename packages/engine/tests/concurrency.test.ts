import { afterEach, describe, expect, it } from "vite-plus/test";
import { openBoard, type Board } from "../src/board.ts";
import { toMerc } from "../src/geo.ts";
import { Scene } from "../src/scene.ts";
import type { BoardElement, LineElement, MarkerElement } from "../src/types.ts";

const open: Board[] = [];
afterEach(() => {
  for (const board of open.splice(0)) board.destroy();
});

const board = (id = "peer", crossTab = false) => {
  const b = openBoard(id, { persist: false, crossTab });
  open.push(b);
  return b;
};

/**
 * Two peers whose updates are queued until `sync()`, so edits made before it
 * are concurrent: neither side has seen the other's.
 */
function peers() {
  const a = board();
  const b = board();
  const toA: Uint8Array[] = [];
  const toB: Uint8Array[] = [];
  a.onUpdate((u) => toB.push(u));
  b.onUpdate((u) => toA.push(u));
  const sync = () => {
    while (toA.length > 0 || toB.length > 0) {
      for (const u of toB.splice(0)) b.applyUpdate(u);
      for (const u of toA.splice(0)) a.applyUpdate(u);
    }
  };
  return { a, b, sync };
}

const marker = (id: string, order = "a0"): MarkerElement => ({
  id,
  kind: "marker",
  order,
  refZoom: 5,
  at: [13.4, 52.5],
  color: "rose",
});

const arrow = (id: string, to: string): LineElement => ({
  id,
  kind: "arrow",
  order: "a1",
  refZoom: 5,
  points: [
    [10, 50],
    [13.3, 52.4],
  ],
  color: "ink",
  width: "m",
  to,
});

const expectSame = (a: Board, b: Board) => expect(a.toJSON()).toEqual(b.toJSON());

describe("concurrent edits", () => {
  it("keeps both edits when different fields of one element change", () => {
    const { a, b, sync } = peers();
    a.add(marker("m"));
    sync();
    a.update("m", { color: "sky" });
    b.update("m", { label: { text: "Berlin", style: "box" } });
    sync();
    expectSame(a, b);
    expect(a.get("m")).toMatchObject({ color: "sky", label: { text: "Berlin", style: "box" } });
  });

  it("settles on one value when both change the same field", () => {
    const { a, b, sync } = peers();
    a.add(marker("m"));
    sync();
    a.update("m", { color: "sky" });
    b.update("m", { color: "violet" });
    sync();
    expectSame(a, b);
    expect(["sky", "violet"]).toContain(a.get("m")?.color);
  });

  it("treats a line's points as one value: one move wins whole, never a mix", () => {
    const { a, b, sync } = peers();
    a.add(arrow("l", "m"));
    sync();
    const movedByA: LineElement["points"] = [
      [0, 0],
      [1, 1],
    ];
    const movedByB: LineElement["points"] = [
      [5, 5],
      [6, 6],
    ];
    a.update("l", { points: movedByA });
    b.update("l", { points: movedByB });
    sync();
    expectSame(a, b);
    const points = (a.get("l") as LineElement).points;
    expect([movedByA, movedByB]).toContainEqual(points);
  });

  it("deletes the element when one side deletes it while the other edits it", () => {
    const { a, b, sync } = peers();
    a.add(marker("m"));
    sync();
    a.remove(["m"]);
    b.update("m", { color: "sky", label: { text: "Gone?", style: "plain" } });
    sync();
    expectSame(a, b);
    expect(a.get("m")).toBeUndefined();
    expect(a.all()).toEqual([]);
  });

  it("keeps both of two elements added at once, stacked the same way on both sides", () => {
    const { a, b, sync } = peers();
    // Both peers see the same top element, so they pick the same order key.
    const orderA = a.nextOrder();
    const orderB = b.nextOrder();
    expect(orderA).toBe(orderB);
    a.add(marker("from-a", orderA));
    b.add(marker("from-b", orderB));
    sync();
    expectSame(a, b);

    const stacking = (peer: Board) => {
      const scene = new Scene();
      const elements = new Map(peer.all().map((el) => [el.id, el]));
      scene.apply(elements.keys(), (id) => elements.get(id));
      return [...elements.keys()].sort((x, y) => scene.rank(x) - scene.rank(y));
    };
    expect(stacking(a)).toEqual(["from-a", "from-b"]);
    expect(stacking(b)).toEqual(stacking(a));
  });
});

describe("undo with another peer", () => {
  it("undoes only your own edit and keeps theirs", () => {
    const { a, b, sync } = peers();
    a.add(marker("m"));
    sync();
    a.update("m", { color: "sky" });
    b.update("m", { label: { text: "Lunch", style: "box" } });
    sync();

    a.undo();
    sync();
    expectSame(a, b);
    expect(a.get("m")).toMatchObject({ color: "rose", label: { text: "Lunch", style: "box" } });
  });

  it("doesn't make the other peer's changes undoable", () => {
    const { a, b, sync } = peers();
    a.add(marker("m"));
    sync();
    expect(b.history().canUndo).toBe(false);
  });
});

describe("catching up", () => {
  it("converges when updates arrive late, twice and out of order", () => {
    const a = board();
    const b = board();
    const updates: Uint8Array[] = [];
    a.onUpdate((u) => updates.push(u));
    a.add(marker("m1"));
    a.update("m1", { color: "sky" });
    a.add(marker("m2", "a1"));
    a.remove(["m1"]);
    const [u1, u2, u3, u4] = updates;

    for (const u of [u4!, u2!, u4!, u3!, u1!, u2!]) b.applyUpdate(u);
    expectSame(a, b);
    expect(b.all().map((el) => el.id)).toEqual(["m2"]);
  });

  it("catches a new peer up from the full state", () => {
    const a = board();
    a.add(marker("m"));
    a.add(arrow("l", "m"));
    const b = board();
    b.applyUpdate(a.encodeState());
    expectSame(a, b);
  });

  it("still draws a line whose snapped marker was deleted by the other side", () => {
    const { a, b, sync } = peers();
    a.add(marker("m"));
    a.add(arrow("l", "m"));
    sync();
    b.remove(["m"]);
    sync();

    const scene = new Scene();
    const elements = new Map<string, BoardElement>(a.all().map((el) => [el.id, el]));
    scene.apply(["m", "l"], (id) => elements.get(id));
    const line = elements.get("l") as LineElement;
    expect(scene.linePath(line)).toEqual(line.points.map((p) => toMerc(p)));
  });
});

describe("tabs", () => {
  it("syncs concurrent edits between two tabs of the same board", async () => {
    const tab1 = board("shared-board", true);
    const tab2 = board("shared-board", true);
    tab1.add(marker("m"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(tab2.get("m")).toBeDefined();

    tab1.update("m", { color: "emerald" });
    tab2.update("m", { label: { text: "Cafe", style: "plain" } });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expectSame(tab1, tab2);
    expect(tab2.get("m")).toMatchObject({ color: "emerald", label: { text: "Cafe", style: "plain" } });
  });
});
