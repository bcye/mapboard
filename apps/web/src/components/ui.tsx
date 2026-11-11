import { useLayoutEffect, type ComponentProps, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx } from "../lib/cx.ts";
import { usePopover } from "../lib/popover.ts";

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

/** The colour chip inside a swatch. */
export function SwatchDot({
  colorClass,
  active = false,
  size = "dot",
}: {
  colorClass: string;
  active?: boolean;
  size?: "dot" | "paper";
}) {
  return (
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
  );
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
      <SwatchDot colorClass={colorClass} active={active} size={size} />
    </button>
  );
}

/**
 * Button that opens a one-unit bar of options next to it. The bar is portaled to
 * the body, so a scrolling toolbar doesn't clip it. It opens towards the middle
 * of the screen: above a bottom toolbar, below a top one.
 */
export function PopoverButton({
  label,
  trigger,
  className,
  children,
}: {
  label: string;
  trigger: ReactNode;
  className?: string;
  children: (close: () => void) => ReactNode;
}) {
  const { open, setOpen, ref, floating } = usePopover<HTMLButtonElement>();

  // Positioned straight in the DOM: it depends on the bar's measured size.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const button = ref.current?.getBoundingClientRect();
      const bar = floating.current;
      if (!button || !bar) return;
      const gap = 10;
      const below = button.top + button.height / 2 < window.innerHeight / 2;
      const top = below ? button.bottom + gap : button.top - bar.offsetHeight - gap;
      const centered = button.left + button.width / 2 - bar.offsetWidth / 2;
      const left = Math.max(8, Math.min(centered, window.innerWidth - bar.offsetWidth - 8));
      bar.style.top = `${top}px`;
      bar.style.left = `${left}px`;
      bar.style.visibility = "visible";
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, ref, floating]);

  return (
    <>
      <IconButton
        ref={ref}
        compact
        label={label}
        active={open}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={className}
      >
        {trigger}
      </IconButton>
      {open &&
        createPortal(
          <Panel
            ref={floating}
            role="toolbar"
            aria-label={label}
            className="invisible fixed top-0 left-0 z-40"
          >
            {children(() => setOpen(false))}
          </Panel>,
          document.body,
        )}
    </>
  );
}
