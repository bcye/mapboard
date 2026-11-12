import { createContext, use } from "react";
import type { Engine, MapStyleOption } from "engine";
import { parseMapStyles } from "engine";

/**
 * Used when VITE_MAP_STYLES is unset: OSM Liberty (public/map-styles) on the
 * PMTiles planet build. MapLibre needs an absolute style URL.
 */
const DEFAULT_MAP_STYLES: MapStyleOption[] = [
  {
    name: "Liberty",
    url: new URL(`${import.meta.env.BASE_URL}map-styles/osm-liberty.json`, location.href).href,
  },
];

export const mapStyles = parseMapStyles(import.meta.env.VITE_MAP_STYLES, DEFAULT_MAP_STYLES);

export const EngineContext = createContext<Engine | null>(null);

export function useEngine(): Engine {
  const engine = use(EngineContext);
  if (!engine) throw new Error("useEngine must be used inside EngineContext");
  return engine;
}
