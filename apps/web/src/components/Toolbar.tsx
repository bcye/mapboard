import { useStore } from "@nanostores/react";
import { TOOLS } from "engine";
import { cx } from "../lib/cx.ts";
import { useEngine } from "../lib/engine.ts";
import { TOOL_META } from "./tools.ts";
import { Panel } from "./ui.tsx";

/** Mode selection. */
export function Toolbar() {
  const engine = useEngine();
  const current = useStore(engine.state.$tool);
  return (
    <Panel role="toolbar" aria-label="Tools" className="gap-1">
      {TOOLS.map(({ id, key }) => {
        const { label, Icon, idle, active, activeWeight = "fill" } = TOOL_META[id];
        const selected = current === id;
        return (
          <button
            key={id}
            type="button"
            title={`${label} (${key})`}
            aria-label={label}
            aria-pressed={selected}
            onClick={() => engine.setTool(id)}
            className={cx(
              "relative grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl transition select-none active:scale-95",
              selected ? active : idle,
            )}
          >
            <Icon size={24} weight={selected ? activeWeight : "duotone"} />
            <span
              className={cx(
                "absolute right-1 bottom-0.5 hidden text-[9px] leading-none font-semibold md:block",
                selected ? "opacity-70" : "text-stone-400",
              )}
            >
              {key}
            </span>
          </button>
        );
      })}
    </Panel>
  );
}
