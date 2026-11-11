import { atom } from "nanostores";
import type { History } from "./board.ts";
import type { BoardElement, LabelStyle, ToolId, Width } from "./types.ts";

/** Tool settings, remembered on this device. */
export interface ToolPrefs {
  /** Palette key for strokes, arrows, markers and pins. */
  ink: string;
  /** Palette key for post-its. */
  paper: string;
  width: Width;
  /** Style for new labels: the last one picked. */
  labelStyle: LabelStyle;
  /** Index into the configured map styles. */
  mapStyle: number;
}

const PREFS_KEY = "map-board:prefs";

const defaultPrefs: ToolPrefs = { ink: "rose", paper: "amber", width: "m", labelStyle: "plain", mapStyle: 0 };

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
    /** Board a new pin links to: a board id, or "new" to create one. */
    $pinTarget: atom<string>("new"),
    /** Name for the board a new pin creates. Empty means a default name. */
    $pinName: atom<string>(""),
    $selection: atom<string | null>(null),
    /** Current value of the selected element, kept in sync with the board. */
    $selected: atom<BoardElement | null>(null),
    /** Post-it whose text is being edited. */
    $editing: atom<string | null>(null),
    /** Label being edited on the map, with the style it will be saved in. */
    $labelDraft: atom<{ id: string; style: LabelStyle } | null>(null),
    $history: atom<History>({ canUndo: false, canRedo: false }),
    $boardId: atom<string | null>(null),
    $loading: atom<boolean>(true),
    $empty: atom<boolean>(true),
    /** Set when the basemap fails to load, e.g. a wrong API key. */
    $mapError: atom<string | null>(null),
  };
}

export type UiState = ReturnType<typeof createUiState>;
