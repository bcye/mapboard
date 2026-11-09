import { ArrowUUpLeft, ArrowUUpRight, Check, MapTrifold, Minus, Plus } from "@phosphor-icons/react";
import { useStore } from "@nanostores/react";
import { cx } from "../lib/cx.ts";
import { useEngine } from "../lib/engine.ts";
import { usePopover } from "../lib/popover.ts";
import { Card, IconButton, Panel } from "./ui.tsx";

const STYLE_CHIPS = [
  "from-emerald-300 to-sky-400",
  "from-amber-200 to-orange-400",
  "from-sky-300 to-indigo-500",
  "from-lime-200 to-teal-400",
  "from-rose-200 to-violet-400",
];

/** Basemap choice. */
export function StylePicker() {
  const engine = useEngine();
  const prefs = useStore(engine.state.$prefs);
  const index = Math.min(prefs.mapStyle, engine.styles.length - 1);
  const { open, setOpen, ref } = usePopover<HTMLDivElement>();
  return (
    <div ref={ref} className="pointer-events-auto relative">
      <Panel>
        <IconButton label="Map style" active={open} onClick={() => setOpen(!open)}>
          <MapTrifold size={24} weight="duotone" className="text-emerald-600" />
        </IconButton>
      </Panel>
      {open && (
        <Card className="absolute top-14 right-0 z-20 w-56">
          <p className="px-2 pt-1 pb-1.5 text-[11px] font-semibold tracking-wide text-stone-500 uppercase">
            Map style
          </p>
          {engine.styles.map((style, i) => (
            <button
              key={style.url}
              type="button"
              onClick={() => {
                engine.setMapStyle(i);
                setOpen(false);
              }}
              className={cx(
                "flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-sm font-medium transition hover:bg-orange-100/70",
                i === index && "bg-orange-100",
              )}
            >
              <span
                className={cx(
                  "size-6 shrink-0 rounded-lg bg-linear-to-br ring-1 ring-black/10",
                  STYLE_CHIPS[i % STYLE_CHIPS.length],
                )}
              />
              <span className="flex-1 truncate">{style.name}</span>
              {i === index && <Check size={16} weight="bold" className="text-orange-600" />}
            </button>
          ))}
        </Card>
      )}
    </div>
  );
}

export function HistoryControls() {
  const engine = useEngine();
  const { canUndo, canRedo } = useStore(engine.state.$history);
  return (
    <Panel>
      <IconButton label="Undo (Ctrl+Z)" disabled={!canUndo} onClick={() => engine.undo()}>
        <ArrowUUpLeft size={22} weight="bold" />
      </IconButton>
      <IconButton label="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={() => engine.redo()}>
        <ArrowUUpRight size={22} weight="bold" />
      </IconButton>
    </Panel>
  );
}

export function ZoomControls() {
  const engine = useEngine();
  return (
    <Panel>
      <IconButton label="Zoom out" onClick={() => engine.zoomBy(-1)}>
        <Minus size={20} weight="bold" />
      </IconButton>
      <IconButton label="Zoom in" onClick={() => engine.zoomBy(1)}>
        <Plus size={20} weight="bold" />
      </IconButton>
    </Panel>
  );
}
