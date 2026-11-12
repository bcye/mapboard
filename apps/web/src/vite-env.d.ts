interface ImportMetaEnv {
  /** MapLibre style URL for the basemap; overrides the bundled OSM Liberty style. */
  readonly VITE_MAP_STYLE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
