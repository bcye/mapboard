# Mapboard

Like Excalidraw on a map: Plan freely with markers, post-its and sketching. Organise but linking to other boards from markers.

Try it out at [mapboard.bruceroettgers.eu](https://mapboard.bruceroettgers.eu)

## Layout

```
packages/engine   Framework-free TypeScript: board model (Yjs), tools, MapLibre rendering, UI store
apps/web          React + Tailwind UI around the engine
docs              Product and architecture decisions and planning
```

The engine has no framework dependency, so the UI can be rebuilt in other frameworks on top of it. Inside it, `board.ts` is the only module that imports Yjs.

## Development

The toolchain is [Vite+](https://viteplus.dev). With the global `vp` CLI, run the commands as shown; without it, prefix them with `pnpm exec` (e.g. `pnpm exec vp dev`).

```bash
vp install          # install dependencies (pnpm, pinned in package.json)
vp dev              # dev server for apps/web
vp check            # format, lint and type check
vp test             # engine unit tests
vp build            # production build of apps/web
vp run ready        # check, test and build everything
```

To pass dev server flags, target the app directly, e.g. `vp -C apps/web dev --host` to try it on a phone on the same network.

`vp dev`, `vp test` and `vp build` are built-in commands. `vp run <name>` runs a `package.json` script, e.g. `vp run web#build` also type-checks the app with `tsc -b`. A pre-commit hook runs `vp check --fix` on staged files.

## Map style

The basemap is the [Protomaps](https://docs.protomaps.com/basemaps/maplibre) light style ([`apps/web/src/lib/map-style.ts`](apps/web/src/lib/map-style.ts)), with vector tiles from the PMTiles planet build at `pmtiles-planet.b-cdn.net`.

## Data

Boards are stored in the browser (IndexedDB) and sync live between tabs. Export and import a board as JSON from the board menu. Importing always creates a new board.

## License

MPL-2.0, see [LICENSE](LICENSE)
