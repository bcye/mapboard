/**
 * The board model. This is the only module that imports Yjs, so the rest of the
 * engine works with plain element objects and a later engine swap stays local.
 */
import { generateKeyBetween } from "fractional-indexing";
import { clearDocument, IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import { parseElement } from "./schema.ts";
import type { BoardElement } from "./types.ts";

/** Origin of edits made in this tab; only these are undoable. */
const LOCAL = "local";
/** Origin of updates relayed from another tab with the same board open. */
const OTHER_TAB = "other-tab";
/** Origin of imported content; not undoable. */
const IMPORT = "import";

export type ElementPatch = { [K in string]?: unknown };

export interface History {
  canUndo: boolean;
  canRedo: boolean;
}

export interface Board {
  readonly id: string;
  /** Resolves once the local copy has loaded from IndexedDB. */
  readonly ready: Promise<void>;
  all(): BoardElement[];
  get(id: string): BoardElement | undefined;
  add(element: BoardElement): void;
  update(id: string, patch: ElementPatch): void;
  remove(ids: Iterable<string>): void;
  /** Runs several writes as one change and one undo step. */
  batch(fn: () => void): void;
  /** Order key that stacks above everything on the board. */
  nextOrder(): string;
  /** Called with the ids of changed elements, for local, remote and undo changes alike. */
  onChange(listener: (ids: Set<string>) => void): () => void;
  undo(): void;
  redo(): void;
  history(): History;
  onHistory(listener: (history: History) => void): () => void;
  /** Plain JSON of all elements, keyed by id. */
  toJSON(): Record<string, BoardElement>;
  /** Writes elements, e.g. from an import. Not undoable. */
  load(elements: Record<string, BoardElement>): void;
  destroy(): void;
}

export interface OpenBoardOptions {
  /** Keep the board in IndexedDB. Off in tests. */
  persist?: boolean;
  /** Relay changes live to other tabs with the same board open. */
  crossTab?: boolean;
}

const dbName = (id: string) => `map-board:${id}`;

export function openBoard(id: string, options: OpenBoardOptions = {}): Board {
  const doc = new Y.Doc();
  const elements = doc.getMap<Y.Map<unknown>>("elements");
  const persistence = options.persist === false ? null : new IndexeddbPersistence(dbName(id), doc);
  const ready = persistence ? persistence.whenSynced.then(() => undefined) : Promise.resolve();

  const changeListeners = new Set<(ids: Set<string>) => void>();
  elements.observeDeep((events) => {
    const ids = new Set<string>();
    for (const event of events) {
      if (event.target === elements) {
        for (const key of event.keys.keys()) ids.add(key);
      } else if (typeof event.path[0] === "string") {
        ids.add(event.path[0]);
      }
    }
    if (ids.size > 0) for (const listener of changeListeners) listener(ids);
  });

  const undoManager = new Y.UndoManager(elements, {
    trackedOrigins: new Set([LOCAL]),
    captureTimeout: 0,
  });
  const historyListeners = new Set<(history: History) => void>();
  const history = (): History => ({
    canUndo: undoManager.canUndo(),
    canRedo: undoManager.canRedo(),
  });
  const emitHistory = () => {
    const current = history();
    for (const listener of historyListeners) listener(current);
  };
  undoManager.on("stack-item-added", emitHistory);
  undoManager.on("stack-item-popped", emitHistory);
  undoManager.on("stack-cleared", emitHistory);

  let channel: BroadcastChannel | null = null;
  if (options.crossTab !== false && typeof BroadcastChannel !== "undefined") {
    const tabChannel = new BroadcastChannel(dbName(id));
    tabChannel.onmessage = (event: MessageEvent<Uint8Array>) => {
      Y.applyUpdate(doc, new Uint8Array(event.data), OTHER_TAB);
    };
    doc.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin !== OTHER_TAB && origin !== persistence) tabChannel.postMessage(update);
    });
    channel = tabChannel;
  }

  const read = (map: Y.Map<unknown> | undefined) =>
    map ? (parseElement(map.toJSON()) ?? undefined) : undefined;

  const toYMap = (element: BoardElement) =>
    new Y.Map<unknown>(Object.entries(element).filter(([, value]) => value !== undefined));

  return {
    id,
    ready,
    all() {
      const out: BoardElement[] = [];
      for (const map of elements.values()) {
        const element = read(map);
        if (element) out.push(element);
      }
      return out;
    },
    get: (elementId) => read(elements.get(elementId)),
    add(element) {
      doc.transact(() => elements.set(element.id, toYMap(element)), LOCAL);
    },
    update(elementId, patch) {
      const map = elements.get(elementId);
      if (!map) return;
      doc.transact(() => {
        for (const [key, value] of Object.entries(patch)) {
          if (value === undefined) map.delete(key);
          else if (JSON.stringify(map.get(key)) !== JSON.stringify(value)) map.set(key, value);
        }
      }, LOCAL);
    },
    remove(ids) {
      doc.transact(() => {
        for (const elementId of ids) elements.delete(elementId);
      }, LOCAL);
    },
    batch(fn) {
      doc.transact(fn, LOCAL);
    },
    nextOrder() {
      let max: string | null = null;
      for (const map of elements.values()) {
        const order = map.get("order");
        if (typeof order === "string" && (max === null || order > max)) max = order;
      }
      return generateKeyBetween(max, null);
    },
    onChange(listener) {
      changeListeners.add(listener);
      return () => changeListeners.delete(listener);
    },
    undo: () => void undoManager.undo(),
    redo: () => void undoManager.redo(),
    history,
    onHistory(listener) {
      historyListeners.add(listener);
      return () => historyListeners.delete(listener);
    },
    toJSON() {
      const out: Record<string, BoardElement> = {};
      for (const element of this.all()) out[element.id] = element;
      return out;
    },
    load(incoming) {
      doc.transact(() => {
        for (const element of Object.values(incoming)) elements.set(element.id, toYMap(element));
      }, IMPORT);
    },
    destroy() {
      changeListeners.clear();
      historyListeners.clear();
      undoManager.destroy();
      channel?.close();
      void persistence?.destroy();
      doc.destroy();
    },
  };
}

/** Deletes a board's local copy. */
export function deleteBoardData(id: string): Promise<void> {
  return clearDocument(dbName(id));
}
