import { AirplaneTilt, WarningCircle } from "@phosphor-icons/react";
import { useStore } from "@nanostores/react";
import { useEffect } from "react";
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
          <span className="font-hand text-2xl leading-7 font-semibold text-stone-800">Where to?</span>
          <br />
          Drop a marker, sketch a route or stick a post-it. Board pins link to other boards, like one per
          city.
        </p>
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
