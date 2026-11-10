# excalidraw-map

Excalidraw for maps: sketch routes, drop markers and stick post-its on a real map. Local-first prototype.

Planning lives in [`docs/`](docs/), and the reasoning behind it in [issue 1](https://github.com/bcye/excalidraw-map/issues/1).

## Layout

```
packages/engine   Framework-free TypeScript: board model (Yjs), tools, MapLibre rendering, UI store
apps/web          React + Tailwind UI around the engine
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

## Map styles

Basemaps come from `VITE_MAP_STYLES` in `apps/web/.env.local`: a JSON list of `{ name, url }` MapLibre style URLs, first one default. See [`apps/web/.env.example`](apps/web/.env.example) for MapTiler streets, outdoor and satellite. The deploy workflow reads it from the `VITE_MAP_STYLES` repository secret. Without it, the app uses OpenFreeMap styles, which need no key.

## Data

Boards are stored in the browser (IndexedDB) and sync live between tabs. Export and import a board as JSON from the board menu. Importing always creates a new board.
