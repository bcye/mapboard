import { describe, expect, it, vi } from "vite-plus/test";
import { parseMapStyles, type MapStyleOption } from "../src/styles.ts";

const FALLBACK: MapStyleOption[] = [{ name: "Default", url: "https://example.com/default.json" }];

describe("map styles", () => {
  it("reads a JSON list of { name, url }", () => {
    const raw = JSON.stringify([
      { name: "Streets", url: "https://example.com/streets.json" },
      { name: "Broken" },
    ]);
    expect(parseMapStyles(raw, FALLBACK)).toEqual([
      { name: "Streets", url: "https://example.com/streets.json" },
    ]);
  });

  it("falls back when unset or invalid", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseMapStyles(undefined, FALLBACK)).toBe(FALLBACK);
    expect(parseMapStyles("", FALLBACK)).toBe(FALLBACK);
    expect(parseMapStyles("{nope", FALLBACK)).toBe(FALLBACK);
    expect(parseMapStyles("[]", FALLBACK)).toBe(FALLBACK);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});
