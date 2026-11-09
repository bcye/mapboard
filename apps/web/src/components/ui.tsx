import type { ComponentProps, ReactNode } from "react";
import { cx } from "../lib/cx.ts";

/** Floating bar on the map. Every toolbar is one unit (h-12) high. */
export function Panel({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cx(
        "pointer-events-auto flex h-12 items-center gap-0.5 rounded-2xl bg-amber-50/95 p-1 shadow-lg ring-1 shadow-orange-950/10 ring-orange-950/10 backdrop-blur-md",
        className,
      )}
    />
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cx(
        "pointer-events-auto rounded-2xl bg-amber-50 p-2 shadow-xl ring-1 shadow-orange-950/15 ring-orange-950/10",
        className,
      )}
    />
  );
}

export function IconButton({
  label,
  active,
  compact,
  className,
  children,
  ...props
}: ComponentProps<"button"> & {
  label: string;
  active?: boolean;
  /** Slightly smaller on phones, for the options bar. */
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      {...props}
      className={cx(
        "grid shrink-0 cursor-pointer place-items-center rounded-xl text-stone-600 transition select-none hover:bg-orange-100/70 active:scale-95 disabled:pointer-events-none disabled:opacity-35",
        compact ? "size-9 md:size-10" : "size-10",
        active && "bg-orange-100 text-orange-600",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Divider() {
  return <div className="mx-1 h-6 w-px shrink-0 bg-orange-950/10" />;
}

export function Swatch({
  label,
  colorClass,
  active,
  onClick,
  size = "dot",
}: {
  label: string;
  colorClass: string;
  active: boolean;
  onClick: () => void;
  size?: "dot" | "paper";
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl transition hover:bg-orange-100/70 active:scale-95 md:size-10"
    >
      <span
        className={cx(
          "block transition",
          size === "dot" ? "size-6 rounded-full" : "size-6 rotate-3 rounded-[4px] shadow-sm",
          colorClass,
          active
            ? "scale-110 ring-2 ring-stone-800 ring-offset-2 ring-offset-amber-50"
            : "ring-1 ring-black/10",
        )}
      />
    </button>
  );
}
