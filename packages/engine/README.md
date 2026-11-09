# engine

Framework-free board engine. A UI mounts it on an empty element with `createEngine(container, { styles })`, then calls `engine.openBoard(id)` and talks to it through commands (`setTool`, `updateSelected`, `undo`, …) and the nanostores in `engine.state`.

| Module                  | Job                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `board.ts`              | Yjs doc per board: elements, undo, IndexedDB, cross-tab sync. The only Yjs import. |
| `scene.ts`              | Elements as drawn: stacking, snapped lines, drag previews                          |
| `render/lines.ts`       | Strokes and arrows as filled polygons in a MapLibre GeoJSON source                 |
| `render/points.ts`      | Markers, post-its, board pins and labels as MapLibre DOM Markers                   |
| `render/draft.ts`       | Canvas for the stroke being drawn                                                  |
| `tools/*`               | Pointer and map events → one board write per finished gesture                      |
| `file.ts`, `schema.ts`  | JSON backup format and validation                                                  |
| `boards.ts`, `state.ts` | Board list on this device, UI store                                                |

Element DOM uses Tailwind classes, so the app's CSS must include `@source` for this package and define `--font-hand`.
