import { useSyncExternalStore } from "react";

/** Boards live at `#/board/<id>`, so links work on any static host. */
export const boardUrl = (id: string) => `#/board/${id}`;

const parse = () => /^#\/board\/([\w-]+)/.exec(location.hash)?.[1] ?? null;

const subscribe = (callback: () => void) => {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
};

export function useBoardId(): string | null {
  return useSyncExternalStore(subscribe, parse);
}

export function goToBoard(id: string, replace = false) {
  if (replace) {
    history.replaceState(null, "", boardUrl(id));
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    location.hash = boardUrl(id);
  }
}

const LAST_KEY = "map-board:last";

export function lastBoardId(): string | null {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}

export function rememberBoard(id: string) {
  try {
    localStorage.setItem(LAST_KEY, id);
  } catch {
    // Not remembered; the newest board opens instead.
  }
}
