interface ImportMetaEnv {
  /** JSON list of `{ name, url }` map styles; the first is the default. */
  readonly VITE_MAP_STYLES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
