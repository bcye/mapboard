import { parseElement } from "./schema.ts";
import type { BoardElement } from "./types.ts";

export const BOARD_FILE_FORMAT = "map-board";
export const BOARD_FILE_VERSION = 1;

/** Backup file. Elements are plain JSON, independent of the Yjs format. */
export interface BoardFile {
  format: typeof BOARD_FILE_FORMAT;
  version: number;
  name?: string;
  elements: Record<string, BoardElement>;
}

export type ParseResult = { ok: true; file: BoardFile; skipped: number } | { ok: false; error: string };

export function createBoardFile(name: string, elements: Record<string, BoardElement>): BoardFile {
  return { format: BOARD_FILE_FORMAT, version: BOARD_FILE_VERSION, name, elements };
}

/**
 * Validates a backup before anything is written, so a bad file fails cleanly.
 * Elements this version can't draw are skipped and counted.
 */
export function parseBoardFile(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file isn't valid JSON." };
  }
  if (typeof data !== "object" || data === null) {
    return { ok: false, error: "This doesn't look like a board backup." };
  }
  const raw = data as Record<string, unknown>;
  if (raw.format !== BOARD_FILE_FORMAT) {
    return { ok: false, error: "This doesn't look like a board backup." };
  }
  if (typeof raw.version !== "number" || raw.version < 1) {
    return { ok: false, error: "The backup has no valid version." };
  }
  if (raw.version > BOARD_FILE_VERSION) {
    return { ok: false, error: "This backup comes from a newer version of the app." };
  }
  if (typeof raw.elements !== "object" || raw.elements === null || Array.isArray(raw.elements)) {
    return { ok: false, error: "The backup has no elements." };
  }
  const elements: Record<string, BoardElement> = {};
  let skipped = 0;
  for (const value of Object.values(raw.elements)) {
    const element = parseElement(value);
    if (element) elements[element.id] = element;
    else skipped++;
  }
  return {
    ok: true,
    skipped,
    file: {
      format: BOARD_FILE_FORMAT,
      version: raw.version,
      name: typeof raw.name === "string" ? raw.name : undefined,
      elements,
    },
  };
}

export function boardFileName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "board"}.map-board.json`;
}

/** Saves the backup as a file download. */
export function downloadBoardFile(file: BoardFile): void {
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = boardFileName(file.name ?? "board");
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
