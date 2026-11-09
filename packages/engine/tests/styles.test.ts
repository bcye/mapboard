import { describe, expect, it, vi } from "vite-plus/test";
import { FALLBACK_MAP_STYLES, parseMapStyles } from "../src/styles.ts";

describe("map styles", () => {
  it("reads a JSON list of { name, url }", () => {
    const raw = JSON.stringify([
      { name: "Streets", url: "https://example.com/streets.json" },
      { name: "Broken" },
    ]);
    expect(parseMapStyles(raw)).toEqual([{ name: "Streets", url: "https://example.com/streets.json" }]);
  });

  it("falls back when unset or invalid", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseMapStyles(undefined)).toBe(FALLBACK_MAP_STYLES);
    expect(parseMapStyles("")).toBe(FALLBACK_MAP_STYLES);
    expect(parseMapStyles("{nope")).toBe(FALLBACK_MAP_STYLES);
    expect(parseMapStyles("[]")).toBe(FALLBACK_MAP_STYLES);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});
