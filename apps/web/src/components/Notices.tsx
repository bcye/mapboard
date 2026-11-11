import { AirplaneTilt, StackPlus, WarningCircle } from "@phosphor-icons/react";
import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";
import { cx } from "../lib/cx.ts";
import { useEngine } from "../lib/engine.ts";
import { $toasts, toast } from "../lib/toast.ts";

/** Friendly start hint on an empty board. */
export function EmptyHint() {
  const engine = useEngine();
  const empty = useStore(engine.state.$empty);
  const loading = useStore(engine.state.$loading);
  if (!empty || loading) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-36 flex justify-center px-4 md:bottom-8">
      <div className="flex max-w-md items-center gap-3 rounded-2xl bg-amber-50/95 px-4 py-3 shadow-lg ring-1 shadow-orange-950/10 ring-orange-950/10 backdrop-blur-md">
        <span className="grid size-11 shrink-0 -rotate-6 place-items-center rounded-full bg-linear-to-br from-sky-400 to-teal-400 text-white shadow-sm shadow-sky-600/30">
          <AirplaneTilt size={24} weight="fill" />
        </span>
        <p className="text-sm leading-snug text-stone-600">
          <span className="font-hand text-2xl leading-7 font-semibold text-stone-800">
            Explore &amp; Plan Freely
          </span>
          <br />
          Plan your next adventure freely with markers, post-its and drawings you can place on this map. Tip:
          Create multiple boards and link to them from pins for more detailed planning.
        </p>
      </div>
    </div>
  );
}

const BOARD_LINK_HINT_KEY = "map-board:hint:board-link";

function hintSeen(key: string) {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

function markHintSeen(key: string) {
  try {
    localStorage.setItem(key, String(Date.now()));
  } catch {
    // Shown again next time; harmless.
  }
}

/** Shown once, the first time a marker is placed: markers can link to a board. */
export function BoardLinkHint() {
  const engine = useEngine();
  const [shownFor, setShownFor] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(
    () =>
      engine.state.$placed.listen((placed) => {
        if (placed?.kind !== "marker" || hintSeen(BOARD_LINK_HINT_KEY)) return;
        markHintSeen(BOARD_LINK_HINT_KEY);
        setShownFor(placed.id);
      }),
    [engine],
  );
  // Once someone links a marker, they've found it.
  useEffect(() => {
    const stops = [
      engine.state.$labelDraft.listen((draft) => draft?.purpose === "board" && setDismissed(true)),
      engine.state.$selected.listen((el) => el?.kind === "marker" && el.boardId && setDismissed(true)),
    ];
    return () => stops.forEach((stop) => stop());
  }, [engine]);
  useEffect(() => {
    if (!shownFor) return;
    const timer = setTimeout(() => setDismissed(true), 20_000);
    return () => clearTimeout(timer);
  }, [shownFor]);

  if (!shownFor || dismissed) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-36 z-20 flex justify-center px-4 md:top-36 md:bottom-auto">
      <div
        role="status"
        className="pointer-events-auto flex max-w-sm items-center gap-3 rounded-2xl bg-amber-50/95 py-3 pr-2 pl-4 shadow-lg ring-1 shadow-orange-950/10 ring-orange-950/10 backdrop-blur-md"
      >
        <span className="grid size-10 shrink-0 rotate-3 place-items-center rounded-xl bg-violet-500 text-white shadow-sm shadow-violet-600/30">
          <StackPlus size={22} weight="fill" />
        </span>
        <p className="text-sm leading-snug text-stone-600">
          <span className="font-hand text-xl leading-6 font-semibold text-stone-800">Planning a city?</span>
          <br />
          Select a marker and tap <span className="font-semibold text-stone-800">Link Board</span> to plan it
          on a board of its own.
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 cursor-pointer self-stretch rounded-xl px-2.5 text-sm font-semibold text-violet-700 hover:bg-violet-50"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

export function Toasts() {
  const engine = useEngine();
  const toasts = useStore($toasts);
  const mapError = useStore(engine.state.$mapError);
  useEffect(() => {
    if (mapError) toast(mapError, "error");
  }, [mapError]);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 top-20 z-30 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            "flex max-w-sm items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium shadow-lg ring-1",
            t.tone === "error"
              ? "bg-rose-50 text-rose-800 shadow-rose-900/10 ring-rose-900/10"
              : "bg-stone-800 text-amber-50 shadow-stone-900/20 ring-black/10",
          )}
        >
          {t.tone === "error" && <WarningCircle size={18} weight="fill" className="shrink-0" />}
          {t.message}
        </div>
      ))}
    </div>
  );
}
