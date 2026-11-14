import { layers, namedFlavor } from "@protomaps/basemaps";
import type { EngineOptions } from "engine";

/**
 * The CDN sends no ETag and caches ranges for ~300 days, so browsers can't tell
 * when the archive changes. Bump `v` to make every browser fetch it fresh (the
 * CDN ignores the query string).
 */
const TILES = "https://pmtiles-planet.b-cdn.net/planet-20261112.pmtiles?v=2";
const ASSETS = "https://protomaps.github.io/basemaps-assets";
const FLAVOR = "light";

/** Protomaps basemap style for the PMTiles planet build. */
export const mapStyle: EngineOptions["style"] = {
  version: 8,
  glyphs: `${ASSETS}/fonts/{fontstack}/{range}.pbf`,
  sprite: `${ASSETS}/sprites/v4/${FLAVOR}`,
  sources: {
    protomaps: {
      type: "vector",
      url: `pmtiles://${TILES}`,
      attribution:
        '<a href="https://protomaps.com" target="_blank">Protomaps</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
    },
  },
  layers: layers("protomaps", namedFlavor(FLAVOR), { lang: "en" }),
};
