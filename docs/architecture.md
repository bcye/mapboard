# Architecture

## Wanted

- Editing without sync, plus sync. Ideally local-first with optional sync/collab. If that's too hard, sync only.
- Native mobile (Expo etc.): if at all, later

## Decided

- Yjs as store. Probably more mature, sync seems much more robust.
- MapLibre. No Mapbox lock-in, plenty of good other tile providers.
- Probably no raster tiles down the road
- Drawing: everything MapLibre (markers and layers), unless it really doesn't work for what we're trying to do
- Vite
- Engine/non-framework code lives separately, so frameworks can be trialed
- React for the first prototype. Probably rebuild later in other frameworks, just to try them.
- CSR, probably settled
- Tiles: probably MapTiler, as in mapvoyage. Provider setup in an env var so it can be swapped.

## To decide

- Sync server
- Open source split (stays an option, sync can be decoupled)
