import { atom } from "nanostores";

export interface Toast {
  id: number;
  message: string;
  tone: "info" | "error";
}

export const $toasts = atom<Toast[]>([]);

let next = 1;

export function toast(message: string, tone: Toast["tone"] = "info") {
  const id = next++;
  $toasts.set([...$toasts.get(), { id, message, tone }]);
  setTimeout(() => $toasts.set($toasts.get().filter((t) => t.id !== id)), 4000);
}
