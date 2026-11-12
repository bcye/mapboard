import { createContext, use } from "react";
import type { Engine } from "engine";

/** OSM Liberty (public/map-styles) on the PMTiles planet build. MapLibre needs an absolute URL. */
export const mapStyle = new URL(`${import.meta.env.BASE_URL}map-styles/osm-liberty.json`, location.href).href;

export const EngineContext = createContext<Engine | null>(null);

export function useEngine(): Engine {
  const engine = use(EngineContext);
  if (!engine) throw new Error("useEngine must be used inside EngineContext");
  return engine;
}
