import { useEffect, useRef, useState } from "react";

/**
 * Open state for a popover that closes on outside click or Escape. Clicks inside
 * `ref` or `floating` (content portaled elsewhere) count as inside.
 */
export function usePopover<T extends HTMLElement, F extends HTMLElement = HTMLDivElement>() {
  const [open, setOpen] = useState(false);
  const ref = useRef<T>(null);
  const floating = useRef<F>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!ref.current?.contains(target) && !floating.current?.contains(target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, ref, floating };
}
