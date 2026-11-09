/** A selectable basemap: any MapLibre style URL. */
export interface MapStyleOption {
  name: string;
  url: string;
}

/**
 * Used when no styles are configured. OpenFreeMap needs no API key, so the app
 * runs without setup. Configure the real provider via VITE_MAP_STYLES.
 */
export const FALLBACK_MAP_STYLES: MapStyleOption[] = [
  { name: "Liberty", url: "https://tiles.openfreemap.org/styles/liberty" },
  { name: "Bright", url: "https://tiles.openfreemap.org/styles/bright" },
  { name: "Positron", url: "https://tiles.openfreemap.org/styles/positron" },
];

/**
 * Parses a JSON list of `{ name, url }`. The first entry is the default.
 * Returns the fallback styles when the value is missing or invalid.
 */
export function parseMapStyles(raw: string | undefined): MapStyleOption[] {
  if (!raw?.trim()) return FALLBACK_MAP_STYLES;
  try {
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) throw new Error("not a list");
    const styles = list.filter(
      (s): s is MapStyleOption =>
        typeof s === "object" &&
        s !== null &&
        typeof s.name === "string" &&
        typeof s.url === "string" &&
        s.url !== "",
    );
    if (styles.length === 0) throw new Error("no valid entries");
    return styles;
  } catch (error) {
    console.warn("VITE_MAP_STYLES is invalid, using fallback styles.", error);
    return FALLBACK_MAP_STYLES;
  }
}
