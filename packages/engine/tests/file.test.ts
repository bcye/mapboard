import { describe, expect, it } from "vite-plus/test";
import { boardFileName, createBoardFile, parseBoardFile } from "../src/file.ts";
import type { NoteElement } from "../src/types.ts";

const note: NoteElement = {
  id: "n1",
  kind: "note",
  order: "a0",
  refZoom: 6,
  at: [-9.14, 38.72],
  text: "Pastéis de nata",
  color: "amber",
};

describe("board file", () => {
  it("parses its own export", () => {
    const text = JSON.stringify(createBoardFile("Lisbon", { n1: note }));
    const result = parseBoardFile(text);
    expect(result).toEqual({
      ok: true,
      skipped: 0,
      file: { format: "map-board", version: 1, name: "Lisbon", elements: { n1: note } },
    });
  });

  it("rejects files that aren't backups", () => {
    expect(parseBoardFile("not json")).toMatchObject({ ok: false });
    expect(parseBoardFile("[]")).toMatchObject({ ok: false });
    expect(parseBoardFile('{"format":"other","version":1,"elements":{}}')).toMatchObject({ ok: false });
    expect(parseBoardFile('{"format":"map-board","version":1}')).toMatchObject({ ok: false });
  });

  it("rejects backups from a newer version", () => {
    const result = parseBoardFile('{"format":"map-board","version":99,"elements":{}}');
    expect(result).toEqual({ ok: false, error: "This backup comes from a newer version of the app." });
  });

  it("skips invalid elements and counts them", () => {
    const result = parseBoardFile(
      JSON.stringify({
        format: "map-board",
        version: 1,
        elements: { n1: note, x: { id: "x", kind: "marker", at: [0, 200] } },
      }),
    );
    expect(result).toMatchObject({ ok: true, skipped: 1 });
  });

  it("keeps a resized post-it's size and skips a broken one", () => {
    const result = parseBoardFile(
      JSON.stringify({
        format: "map-board",
        version: 1,
        elements: {
          n1: { ...note, size: [220, 90] },
          n2: { ...note, id: "n2", size: [220] },
          n3: { ...note, id: "n3", size: [0, 90] },
        },
      }),
    );
    expect(result).toMatchObject({ ok: true, skipped: 2, file: { elements: { n1: { size: [220, 90] } } } });
  });

  it("makes a safe file name", () => {
    expect(boardFileName("Road trip: Côte d'Azur!")).toBe("road-trip-c-te-d-azur.map-board.json");
    expect(boardFileName("")).toBe("board.map-board.json");
  });
});
