import { ArrowUUpLeft, ArrowUUpRight, Minus, Plus } from "@phosphor-icons/react";
import { useStore } from "@nanostores/react";
import { useEngine } from "../lib/engine.ts";
import { IconButton, Panel } from "./ui.tsx";

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
