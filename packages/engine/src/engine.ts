import "./map-assets.ts";
import { LngLatBounds, Map as MapLibreMap } from "maplibre-gl";
import { openBoard as openBoardDoc, type Board } from "./board.ts";
import { $boards, createBoardMeta, ensureBoardMeta, findBoard, touchBoard } from "./boards.ts";
import { createBoardFile, type BoardFile } from "./file.ts";
import { roundCoord } from "./geo.ts";
import { DraftLayer } from "./render/draft.ts";
import { LinesRenderer } from "./render/lines.ts";
import { PointsRenderer } from "./render/points.ts";
import { Scene } from "./scene.ts";
import { createUiState, type ToolPrefs, type UiState } from "./state.ts";
import type { MapStyleOption } from "./styles.ts";
import type { ScreenPoint, Tool, ToolContext } from "./tools/context.ts";
import { createEraserTool } from "./tools/eraser.ts";
import { createInkTool } from "./tools/ink.ts";
import { createPlaceTool } from "./tools/place.ts";
import { createSelectTool } from "./tools/select.ts";
import { isLine, type BoardElement, type Label, type LabelStyle, type ToolId, type Width } from "./types.ts";

export interface EngineOptions {
  /** Basemaps to choose from; the first is the default. */
  styles: MapStyleOption[];
}

export interface SelectedPatch {
  color?: string;
  width?: Width;
  label?: Label | null;
}

export interface Engine {
  readonly state: UiState;
  readonly styles: MapStyleOption[];
  openBoard(id: string): Promise<void>;
  setTool(tool: ToolId): void;
  setPrefs(patch: Partial<ToolPrefs>): void;
  select(id: string | null): void;
  updateSelected(patch: SelectedPatch): void;
  deleteSelected(): void;
  editSelectedNote(): void;
  /** Edits the selected marker's or line's label on the map. */
  editSelectedLabel(): void;
  /** Style of the label being edited. */
  setLabelStyle(style: LabelStyle): void;
  /** Saves the label or post-it being edited. */
  finishEditing(): void;
  /** Links the selected marker to a board. */
  linkSelected(boardId: string): void;
  /**
   * Links the selected marker to a new board named after its label. Without a
   * label, the name is typed on the map first.
   */
  linkSelectedToNewBoard(): void;
  /** Unlinks the selected marker; the board's name stays as its label. */
  unlinkSelected(): void;
  undo(): void;
  redo(): void;
  zoomBy(delta: number): void;
  setMapStyle(index: number): void;
  exportBoard(): BoardFile | null;
  /** Creates a new board from a backup, opens it and returns its id. */
  importFile(file: BoardFile): Promise<string>;
  destroy(): void;
}

/** Tool order and keyboard shortcuts, shared with the toolbar. */
export const TOOLS: { id: ToolId; key: string }[] = [
  { id: "select", key: "1" },
  { id: "draw", key: "2" },
  { id: "arrow", key: "3" },
  { id: "marker", key: "4" },
  { id: "note", key: "5" },
  { id: "eraser", key: "6" },
];

const LETTER_SHORTCUTS: Record<string, ToolId> = {
  v: "select",
  h: "select",
  d: "draw",
  p: "draw",
  a: "arrow",
  m: "marker",
  n: "note",
  e: "eraser",
};

const POINTER_TOOLS = new Set<ToolId>(["draw", "arrow", "eraser"]);
const DEFAULT_CAMERA = { center: [12, 30] as [number, number], zoom: 1.6 };

const cameraKey = (id: string) => `map-board:camera:${id}`;

function loadCamera(id: string): { center: [number, number]; zoom: number } | null {
  try {
    const raw = localStorage.getItem(cameraKey(id));
    return raw ? (JSON.parse(raw) as { center: [number, number]; zoom: number }) : null;
  } catch {
    return null;
  }
}

/** Elements with a label you can edit. A linked marker's label is its board's name. */
const hasLabel = (element: BoardElement | undefined) =>
  element !== undefined && ((element.kind === "marker" && !element.boardId) || isLine(element));

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

export function createEngine(container: HTMLElement, options: EngineOptions): Engine {
  const state = createUiState();
  const styles = options.styles;
  const styleIndex = () => Math.min(state.$prefs.get().mapStyle, styles.length - 1);

  container.classList.add("em-root");
  container.dataset.tool = "select";

  const map = new MapLibreMap({
    container,
    style: styles[styleIndex()]!.url,
    center: DEFAULT_CAMERA.center,
    zoom: DEFAULT_CAMERA.zoom,
    attributionControl: { compact: true },
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    maxPitch: 0,
    clickTolerance: 4,
  });
  map.touchZoomRotate.disableRotation();
  map.keyboard.disableRotation();

  const scene = new Scene();
  let board: Board | null = null;
  let unsubscribe: (() => void)[] = [];

  const select = (id: string | null) => {
    const element = id ? scene.elements.get(id) : undefined;
    const next = element ? id : null;
    state.$selection.set(next);
    state.$selected.set(element ?? null);
    points.setSelected(next);
    lines.setSelected(next);
  };

  const preview = (ids: Iterable<string>) => {
    const list = [...ids];
    lines.update(list);
    points.preview(list);
  };

  const points = new PointsRenderer(map, scene, {
    click(id) {
      if (state.$tool.get() !== "select") return;
      const element = scene.elements.get(id);
      if (!element) return;
      if (element.kind === "note" && state.$selection.get() === id) {
        points.editNote(id);
      } else {
        select(id);
      }
    },
    doubleClick(id) {
      if (state.$tool.get() !== "select") return;
      const element = scene.elements.get(id);
      if (element?.kind === "note") {
        select(id);
        points.editNote(id);
      } else if (hasLabel(element)) {
        select(id);
        editLabel(id);
      }
    },
    dragStart: (id) => select(id),
    drag(id, at) {
      scene.overrides.set(id, { at });
      preview(scene.linesAttachedTo(id));
    },
    dragEnd(id, at) {
      scene.overrides.delete(id);
      board?.update(id, { at: [roundCoord(at[0]), roundCoord(at[1])] });
      preview(scene.linesAttachedTo(id));
    },
    noteText: (id, text) => board?.update(id, { text }),
    labelText(id, text, style) {
      const draft = state.$labelDraft.get();
      state.$labelDraft.set(null);
      if (draft?.purpose === "board") {
        if (text) link(id, createBoardMeta(text).id);
        return;
      }
      const current = scene.elements.get(id)?.label;
      if (text === (current?.text ?? "") && style === (current?.style ?? style)) return;
      board?.update(id, { label: text ? { text, style } : undefined });
    },
    boardName: (id) => findBoard(id)?.name ?? null,
  });
  const lines = new LinesRenderer(map, scene);

  function editLabel(id: string) {
    const element = scene.elements.get(id);
    if (!hasLabel(element) || state.$labelDraft.get()) return;
    const style = element?.label?.style ?? state.$prefs.get().labelStyle;
    state.$labelDraft.set({ id, style, purpose: "label" });
    points.editLabel(id, style);
    if (points.editingId !== id) state.$labelDraft.set(null);
  }

  /** Types a name for a new board on the map, then links the marker to it. */
  function nameNewBoard(id: string) {
    if (scene.elements.get(id)?.kind !== "marker" || state.$labelDraft.get()) return;
    state.$labelDraft.set({ id, style: "box", purpose: "board" });
    points.editLabel(id, "box", "Name the board…");
    if (points.editingId !== id) state.$labelDraft.set(null);
  }

  // `kind` is written too: board pins from older versions are still stored as "pin".
  const link = (id: string, boardId: string) =>
    board?.update(id, { kind: "marker", boardId, label: undefined });
  const draft = new DraftLayer(map);

  const context: ToolContext = {
    map,
    state,
    scene,
    points,
    lines,
    draft,
    board: () => board,
    select,
    editLabel,
    setTool: (tool) => setTool(tool),
    preview,
  };

  const tools: Record<ToolId, Tool> = {
    select: createSelectTool(context),
    draw: createInkTool(context, "stroke"),
    arrow: createInkTool(context, "arrow"),
    marker: createPlaceTool(context, "marker"),
    note: createPlaceTool(context, "note"),
    eraser: createEraserTool(context),
  };
  let tool: ToolId = "select";
  tools.select.activate?.();
  points.setInteractive(true);

  function setTool(next: ToolId) {
    if (next === tool) return;
    tools[tool].deactivate?.();
    tool = next;
    const drawing = POINTER_TOOLS.has(next);
    const selecting = next === "select";
    if (drawing) map.dragPan.disable();
    else map.dragPan.enable();
    if (selecting) {
      map.doubleClickZoom.enable();
      map.boxZoom.enable();
    } else {
      map.doubleClickZoom.disable();
      map.boxZoom.disable();
    }
    points.setInteractive(selecting);
    container.dataset.tool = next;
    state.$tool.set(next);
    if (!selecting) select(null);
    tools[next].activate?.();
  }

  // Pointer input for drawing tools. Other tools use MapLibre's own events.
  const canvasContainer = map.getCanvasContainer();
  const activePointers = new Set<number>();
  const toScreen = (event: PointerEvent): ScreenPoint => {
    const rect = container.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const onPointerDown = (event: PointerEvent) => {
    if (!POINTER_TOOLS.has(tool)) return;
    activePointers.add(event.pointerId);
    if (activePointers.size > 1) return tools[tool].cancel?.();
    try {
      // Keep receiving moves if the pointer leaves the map mid-stroke.
      canvasContainer.setPointerCapture(event.pointerId);
    } catch {
      // Not an active pointer (e.g. synthetic events); capture is best-effort.
    }
    tools[tool].pointerDown?.(event, toScreen(event));
  };
  const onPointerMove = (event: PointerEvent) => {
    if (POINTER_TOOLS.has(tool) && activePointers.size === 1) {
      tools[tool].pointerMove?.(event, toScreen(event));
    }
  };
  const onPointerUp = (event: PointerEvent) => {
    const single = activePointers.size === 1;
    activePointers.delete(event.pointerId);
    if (POINTER_TOOLS.has(tool) && single) tools[tool].pointerUp?.(event, toScreen(event));
  };
  const onPointerCancel = (event: PointerEvent) => {
    activePointers.delete(event.pointerId);
    tools[tool].cancel?.();
  };
  canvasContainer.addEventListener("pointerdown", onPointerDown);
  canvasContainer.addEventListener("pointermove", onPointerMove);
  canvasContainer.addEventListener("pointerup", onPointerUp);
  canvasContainer.addEventListener("pointercancel", onPointerCancel);

  const onChange = (ids: Set<string>) => {
    if (!board) return;
    const current = board;
    const affected = scene.apply(ids, (id) => current.get(id));
    // Points first: lines snapped to a post-it read its DOM size.
    points.update(affected);
    lines.update(affected);
    const selected = state.$selection.get();
    if (selected && affected.has(selected)) {
      if (scene.elements.has(selected)) {
        state.$selected.set(scene.elements.get(selected) ?? null);
        points.setSelected(selected);
      } else {
        select(null);
      }
    }
    state.$empty.set(scene.elements.size === 0);
    touchBoard(current.id);
  };

  map.on("style.load", () => {
    lines.install();
    state.$mapError.set(null);
  });
  map.on("zoom", () => points.rescale(map.getZoom()));
  map.on("moveend", () => {
    if (!board) return;
    const { lng, lat } = map.getCenter();
    try {
      localStorage.setItem(cameraKey(board.id), JSON.stringify({ center: [lng, lat], zoom: map.getZoom() }));
    } catch {
      // Camera isn't remembered; not a problem.
    }
  });
  map.on("error", (event) => {
    const message = event.error?.message ?? "";
    if (!map.isStyleLoaded() || /style|401|403|key/i.test(message)) {
      state.$mapError.set("The map couldn't load. Check the map style settings or your connection.");
    }
  });

  const stopBoards = $boards.listen(() => points.refreshLinks());

  const onKeyDown = (event: KeyboardEvent) => {
    if (isTyping(event.target)) return;
    const key = event.key.toLowerCase();
    if (event.metaKey || event.ctrlKey) {
      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) board?.redo();
        else board?.undo();
      } else if (key === "y") {
        event.preventDefault();
        board?.redo();
      }
      return;
    }
    if (event.altKey) return;
    if (key === "delete" || key === "backspace") {
      if (state.$selection.get()) {
        event.preventDefault();
        engine.deleteSelected();
      }
    } else if (key === "escape") {
      select(null);
      setTool("select");
    } else if (key === "enter" && state.$selected.get()?.kind === "note") {
      event.preventDefault();
      engine.editSelectedNote();
    } else if (key === "enter" && hasLabel(state.$selected.get() ?? undefined)) {
      event.preventDefault();
      engine.editSelectedLabel();
    } else {
      const next = TOOLS.find((t) => t.key === key)?.id ?? LETTER_SHORTCUTS[key];
      if (next) setTool(next);
    }
  };
  window.addEventListener("keydown", onKeyDown);

  function closeBoard() {
    for (const stop of unsubscribe) stop();
    unsubscribe = [];
    tools[tool].cancel?.();
    points.finishEditing();
    state.$labelDraft.set(null);
    select(null);
    points.clear();
    lines.clear();
    scene.clear();
    board?.destroy();
    board = null;
  }

  function fitToContent() {
    const bounds = new LngLatBounds();
    for (const element of scene.elements.values()) {
      if (isLine(element)) for (const p of element.points) bounds.extend([p[0], p[1]]);
      else bounds.extend(element.at);
    }
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 96, maxZoom: 14, duration: 0 });
  }

  const engine: Engine = {
    state,
    styles,
    async openBoard(id) {
      if (board?.id === id) return;
      closeBoard();
      ensureBoardMeta(id);
      state.$loading.set(true);
      state.$boardId.set(id);
      state.$empty.set(true);
      state.$history.set({ canUndo: false, canRedo: false });
      const next = openBoardDoc(id);
      board = next;
      const camera = loadCamera(id) ?? DEFAULT_CAMERA;
      map.jumpTo(camera);
      await next.ready;
      if (board !== next) return;
      unsubscribe.push(next.onChange(onChange));
      unsubscribe.push(next.onHistory((history) => state.$history.set(history)));
      onChange(new Set(next.all().map((element) => element.id)));
      if (!loadCamera(id)) fitToContent();
      state.$loading.set(false);
    },
    setTool,
    setPrefs(patch) {
      state.$prefs.set({ ...state.$prefs.get(), ...patch });
    },
    select,
    updateSelected(patch) {
      const id = state.$selection.get();
      if (!id || !board) return;
      const { label, ...rest } = patch;
      board.update(id, label === undefined ? rest : { ...rest, label: label ?? undefined });
    },
    deleteSelected() {
      const id = state.$selection.get();
      if (!id || !board) return;
      board.remove([id]);
      select(null);
    },
    editSelectedNote() {
      const id = state.$selection.get();
      if (id && scene.elements.get(id)?.kind === "note") points.editNote(id);
    },
    editSelectedLabel() {
      const id = state.$selection.get();
      if (id) editLabel(id);
    },
    setLabelStyle(style) {
      const draft = state.$labelDraft.get();
      if (!draft) return;
      state.$labelDraft.set({ ...draft, style });
      points.setLabelStyle(style);
      engine.setPrefs({ labelStyle: style });
    },
    finishEditing: () => points.finishEditing(),
    linkSelected(boardId) {
      const id = state.$selection.get();
      if (id && scene.elements.get(id)?.kind === "marker") link(id, boardId);
    },
    linkSelectedToNewBoard() {
      const id = state.$selection.get();
      const element = id ? scene.elements.get(id) : undefined;
      if (!id || element?.kind !== "marker") return;
      const name = element.boardId ? "" : (element.label?.text ?? "");
      if (name) link(id, createBoardMeta(name).id);
      else nameNewBoard(id);
    },
    unlinkSelected() {
      const id = state.$selection.get();
      const element = id ? scene.elements.get(id) : undefined;
      if (!id || element?.kind !== "marker" || !element.boardId) return;
      const name = findBoard(element.boardId)?.name;
      board?.update(id, {
        kind: "marker",
        boardId: undefined,
        label: name ? { text: name, style: "box" } : undefined,
      });
    },
    undo: () => board?.undo(),
    redo: () => board?.redo(),
    zoomBy: (delta) => map.easeTo({ zoom: map.getZoom() + delta, duration: 250 }),
    setMapStyle(index) {
      if (!styles[index] || index === styleIndex()) return;
      engine.setPrefs({ mapStyle: index });
      map.setStyle(styles[index].url, { diff: false });
    },
    exportBoard() {
      if (!board) return null;
      return createBoardFile(findBoard(board.id)?.name ?? "Board", board.toJSON());
    },
    async importFile(file) {
      const base = file.name?.trim() || "Imported board";
      const taken = $boards.get().some((b) => b.name === base);
      const meta = createBoardMeta(taken ? `${base} (imported)` : base);
      await engine.openBoard(meta.id);
      board?.load(file.elements);
      fitToContent();
      return meta.id;
    },
    destroy() {
      window.removeEventListener("keydown", onKeyDown);
      stopBoards();
      closeBoard();
      draft.destroy();
      map.remove();
      container.classList.remove("em-root");
    },
  };
  return engine;
}
