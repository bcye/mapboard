/**
 * Bundler-specific setup, kept in one place. MapLibre 6 finds its worker next
 * to its own module, which breaks once Vite bundles it, so point it at the
 * worker file explicitly.
 */
import "maplibre-gl/dist/maplibre-gl.css";
import "./engine.css";
import { addProtocol, setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { Protocol } from "pmtiles";

setWorkerUrl(workerUrl);

/** Lets styles load vector tiles from a PMTiles archive via `pmtiles://` URLs. */
addProtocol("pmtiles", new Protocol().tile);
