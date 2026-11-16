import { atom } from "nanostores";
import { deleteBoardData } from "./board.ts";
import { uid } from "./id.ts";

/** Entry in this device's list of boards. Board content lives in IndexedDB. */
export interface BoardMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

const KEY = "map-board:index";

function load(): BoardMeta[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list.filter(
      (b): b is BoardMeta =>
        typeof b === "object" && b !== null && typeof b.id === "string" && typeof b.name === "string",
    );
  } catch {
    return [];
  }
}

function save(list: BoardMeta[]) {
  $boards.set(list);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage full or blocked: the list still works for this session.
  }
}

/** Boards on this device, most recently changed first. */
export const $boards = atom<BoardMeta[]>(load());

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === KEY) $boards.set(load());
  });
}

const sorted = (list: BoardMeta[]) => [...list].sort((a, b) => b.updatedAt - a.updatedAt);

export function findBoard(id: string): BoardMeta | undefined {
  return $boards.get().find((b) => b.id === id);
}

const DEFAULT_NAME = /^Untitled board( \d+)?$/;

/** Whether `name` is one given automatically to a new board, not chosen by the user. */
export function isDefaultBoardName(name: string): boolean {
  return DEFAULT_NAME.test(name);
}

function nextName(): string {
  const names = new Set($boards.get().map((b) => b.name));
  if (!names.has("Untitled board")) return "Untitled board";
  let n = 2;
  while (names.has(`Untitled board ${n}`)) n++;
  return `Untitled board ${n}`;
}

export function createBoardMeta(name?: string): BoardMeta {
  const now = Date.now();
  const meta: BoardMeta = { id: uid(), name: name?.trim() || nextName(), createdAt: now, updatedAt: now };
  save(sorted([meta, ...$boards.get()]));
  return meta;
}

/** Adds a board that exists locally but isn't listed, e.g. opened from a link. */
export function ensureBoardMeta(id: string): BoardMeta {
  const existing = findBoard(id);
  if (existing) return existing;
  const now = Date.now();
  const meta: BoardMeta = { id, name: nextName(), createdAt: now, updatedAt: now };
  save(sorted([meta, ...$boards.get()]));
  return meta;
}

export function renameBoard(id: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  save($boards.get().map((b) => (b.id === id ? { ...b, name: trimmed, updatedAt: Date.now() } : b)));
}

export function touchBoard(id: string) {
  const list = $boards.get();
  const board = list.find((b) => b.id === id);
  if (!board || Date.now() - board.updatedAt < 5000) return;
  save(sorted(list.map((b) => (b.id === id ? { ...b, updatedAt: Date.now() } : b))));
}

export async function deleteBoard(id: string) {
  save($boards.get().filter((b) => b.id !== id));
  await deleteBoardData(id);
}
