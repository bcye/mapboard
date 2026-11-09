import { describe, expect, it } from "vite-plus/test";
import { openBoard } from "../src/board.ts";
import type { BoardElement, MarkerElement } from "../src/types.ts";

const local = () => openBoard("test", { persist: false, crossTab: false });

const marker = (id: string, order = "a0"): MarkerElement => ({
  id,
  kind: "marker",
  order,
  refZoom: 5,
  at: [13.4, 52.5],
  color: "rose",
});

describe("board", () => {
  it("adds, updates and removes elements and reports changed ids", () => {
    const board = local();
    const changes: string[][] = [];
    board.onChange((ids) => changes.push([...ids]));

    board.add(marker("m1"));
    board.update("m1", { color: "sky", label: { text: "Berlin", style: "box" } });
    expect(board.get("m1")).toMatchObject({ color: "sky", label: { text: "Berlin", style: "box" } });

    board.update("m1", { label: undefined });
    expect(board.get("m1")?.label).toBeUndefined();

    board.remove(["m1"]);
    expect(board.get("m1")).toBeUndefined();
    expect(changes).toEqual([["m1"], ["m1"], ["m1"], ["m1"]]);
  });

  it("undoes and redoes local edits, one step per change or batch", () => {
    const board = local();
    board.add(marker("m1"));
    board.batch(() => {
      board.add(marker("m2"));
      board.update("m1", { color: "violet" });
    });
    expect(board.history()).toEqual({ canUndo: true, canRedo: false });

    board.undo();
    expect(board.get("m2")).toBeUndefined();
    expect(board.get("m1")?.color).toBe("rose");

    board.redo();
    expect(board.get("m2")).toBeDefined();
    expect(board.get("m1")?.color).toBe("violet");
  });

  it("keeps unknown fields and skips elements it can't draw", () => {
    const board = local();
    board.add({ ...marker("m1"), future: "field" } as BoardElement);
    board.load({ bad: { id: "bad", kind: "teleporter" } as unknown as BoardElement });
    expect(board.all().map((el) => el.id)).toEqual(["m1"]);
    expect((board.get("m1") as unknown as Record<string, unknown>).future).toBe("field");
  });

  it("stacks new elements above existing ones", () => {
    const board = local();
    const first = board.nextOrder();
    board.add(marker("m1", first));
    expect(board.nextOrder() > first).toBe(true);
  });

  it("round-trips through JSON into a new board, and imports aren't undoable", () => {
    const source = local();
    source.add(marker("m1"));
    source.add({
      id: "s1",
      kind: "stroke",
      order: "a1",
      refZoom: 4,
      points: [
        [1, 2],
        [3, 4, 0.5],
      ],
      color: "ink",
      width: "m",
      to: "m1",
    });

    const copy = local();
    copy.load(source.toJSON());
    expect(copy.toJSON()).toEqual(source.toJSON());
    expect(copy.history().canUndo).toBe(false);
  });
});
