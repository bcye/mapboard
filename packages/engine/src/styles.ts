/** A selectable basemap: any MapLibre style URL. */
export interface MapStyleOption {
  name: string;
  url: string;
}

/**
 * Parses a JSON list of `{ name, url }`. The first entry is the default.
 * Returns the fallback styles when the value is missing or invalid.
 */
export function parseMapStyles(raw: string | undefined, fallback: MapStyleOption[]): MapStyleOption[] {
  if (!raw?.trim()) return fallback;
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
    return fallback;
  }
}
