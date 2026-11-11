import { atom } from "nanostores";
import type { History } from "./board.ts";
import type { BoardElement, LabelStyle, TextSize, ToolId, Width } from "./types.ts";

/** Tool settings, remembered on this device. */
export interface ToolPrefs {
  /** Palette key for strokes, arrows and markers. */
  ink: string;
  /** Palette key for post-its. */
  paper: string;
  width: Width;
  /** Text size for post-its. */
  textSize: TextSize;
  /** Style for new labels: the last one picked. */
  labelStyle: LabelStyle;
  /** Index into the configured map styles. */
  mapStyle: number;
}

const PREFS_KEY = "map-board:prefs";

const defaultPrefs: ToolPrefs = {
  ink: "rose",
  paper: "amber",
  width: "m",
  textSize: "m",
  labelStyle: "plain",
  mapStyle: 0,
};

function loadPrefs(): ToolPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    const prefs = raw ? { ...defaultPrefs, ...(JSON.parse(raw) as Partial<ToolPrefs>) } : defaultPrefs;
    return prefs.labelStyle === "box" ? prefs : { ...prefs, labelStyle: "plain" };
  } catch {
    return defaultPrefs;
  }
}

/** Framework-free UI state. UI layers subscribe; only the engine writes most of it. */
export function createUiState() {
  const $prefs = atom<ToolPrefs>(loadPrefs());
  $prefs.listen((prefs) => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // Not persisted; fine for this session.
    }
  });
  return {
    $tool: atom<ToolId>("select"),
    $prefs,
    /** The element placed last with a place tool, e.g. for first-use hints. */
    $placed: atom<{ id: string; kind: "marker" | "note" } | null>(null),
    $selection: atom<string | null>(null),
    /** Current value of the selected element, kept in sync with the board. */
    $selected: atom<BoardElement | null>(null),
    /** Post-it whose text is being edited. */
    $editing: atom<string | null>(null),
    /**
     * Label being edited on the map, with the style it will be saved in.
     * `board` names a new board for a marker to link to instead.
     */
    $labelDraft: atom<{ id: string; style: LabelStyle; purpose: "label" | "board" } | null>(null),
    $history: atom<History>({ canUndo: false, canRedo: false }),
    $boardId: atom<string | null>(null),
    $loading: atom<boolean>(true),
    $empty: atom<boolean>(true),
    /** Set when the basemap fails to load, e.g. a wrong API key. */
    $mapError: atom<string | null>(null),
  };
}

export type UiState = ReturnType<typeof createUiState>;
