import { describe, expect, it } from "vite-plus/test";
import { parseElement } from "../src/schema.ts";

const marker = { id: "m1", kind: "marker", order: "a0", refZoom: 6, at: [13.4, 52.5], color: "rose" };

describe("element schema", () => {
  it("keeps plain and box labels", () => {
    const element = { ...marker, label: { text: "Berlin", style: "plain" } };
    expect(parseElement(element)).toEqual(element);
  });

  it("reads labels styled as a post-it as boxes", () => {
    const element = { ...marker, label: { text: "Berlin", style: "note" } };
    expect(parseElement(element)?.label).toEqual({ text: "Berlin", style: "box" });
  });

  it("rejects unknown label styles", () => {
    expect(parseElement({ ...marker, label: { text: "Berlin", style: "neon" } })).toBeNull();
  });
});
