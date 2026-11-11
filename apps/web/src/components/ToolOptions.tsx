import { ArrowSquareOut, Check, PencilSimpleLine, Tag, Trash, X } from "@phosphor-icons/react";
import { useStore } from "@nanostores/react";
import {
  $boards,
  INK,
  PAPER,
  inkColor,
  paperColor,
  type BoardElement,
  type Label,
  type LabelStyle,
  type ToolId,
  type Width,
} from "engine";
import { useState, type ReactNode } from "react";
import { cx } from "../lib/cx.ts";
import { useEngine } from "../lib/engine.ts";
import { boardUrl } from "../lib/router.ts";
import { Divider, IconButton, Panel, PopoverButton, Swatch, SwatchDot } from "./ui.tsx";

/** Second toolbar: settings for the active tool, or for the selected element. */
export function ToolOptions() {
  const engine = useEngine();
  const tool = useStore(engine.state.$tool);
  const selected = useStore(engine.state.$selected);
  if (tool === "select") return selected ? <SelectionOptions key={selected.id} element={selected} /> : null;
  if (tool === "eraser") return null;
  return <ToolSettings tool={tool} />;
}

function OptionsPanel({ children }: { children: ReactNode }) {
  return (
    <Panel
      className="no-scrollbar max-w-[calc(100vw-1rem)] overflow-x-auto"
      role="toolbar"
      aria-label="Options"
    >
      {children}
    </Panel>
  );
}

function ToolSettings({ tool }: { tool: Exclude<ToolId, "select" | "eraser"> }) {
  const engine = useEngine();
  const prefs = useStore(engine.state.$prefs);
  const setInk = (ink: string) => engine.setPrefs({ ink });
  return (
    <OptionsPanel>
      {tool === "note" ? (
        <PaperRow value={prefs.paper} onChange={(paper) => engine.setPrefs({ paper })} />
      ) : (
        <InkRow value={prefs.ink} onChange={setInk} />
      )}
      {(tool === "draw" || tool === "arrow") && (
        <>
          <Divider />
          <WidthRow value={prefs.width} onChange={(width) => engine.setPrefs({ width })} />
        </>
      )}
      {tool === "pin" && (
        <>
          <Divider />
          <PinTarget />
        </>
      )}
    </OptionsPanel>
  );
}

function SelectionOptions({ element }: { element: BoardElement }) {
  const engine = useEngine();
  const [editingLabel, setEditingLabel] = useState(false);
  if (editingLabel) return <LabelEditor label={element.label} onDone={() => setEditingLabel(false)} />;

  const isLine = element.kind === "stroke" || element.kind === "arrow";
  return (
    <OptionsPanel>
      {element.kind === "note" ? (
        <PaperRow
          value={element.color}
          onChange={(paper) => {
            engine.updateSelected({ color: paper });
            engine.setPrefs({ paper });
          }}
        />
      ) : (
        <InkRow
          value={element.color}
          onChange={(ink) => {
            engine.updateSelected({ color: ink });
            engine.setPrefs({ ink });
          }}
        />
      )}
      {isLine && (
        <>
          <Divider />
          <WidthRow
            value={element.width}
            onChange={(width) => {
              engine.updateSelected({ width });
              engine.setPrefs({ width });
            }}
          />
        </>
      )}
      <Divider />
      {element.kind === "note" && (
        <IconButton compact label="Edit text" onClick={() => engine.editSelectedNote()}>
          <PencilSimpleLine size={22} weight="duotone" />
        </IconButton>
      )}
      {element.kind === "pin" && (
        <>
          <PinRetarget boardId={element.boardId} />
          <IconButton
            compact
            label="Open linked board in a new tab"
            onClick={() => window.open(boardUrl(element.boardId), "_blank", "noopener")}
          >
            <ArrowSquareOut size={22} weight="duotone" />
          </IconButton>
        </>
      )}
      <IconButton
        compact
        label={element.label ? "Edit label" : "Add label"}
        onClick={() => setEditingLabel(true)}
      >
        <Tag size={22} weight="duotone" className="text-orange-500" />
      </IconButton>
      <IconButton
        compact
        label="Delete"
        onClick={() => engine.deleteSelected()}
        className="text-rose-600 hover:bg-rose-100/70"
      >
        <Trash size={22} weight="duotone" />
      </IconButton>
    </OptionsPanel>
  );
}

const LABEL_STYLES: { style: LabelStyle; name: string; preview: string }[] = [
  {
    style: "plain",
    name: "Plain label",
    preview: "font-semibold text-stone-800 [text-shadow:0_1px_2px_rgb(0_0_0/0.25)]",
  },
  {
    style: "box",
    name: "Label in a box",
    preview: "rounded-md bg-white px-1 shadow-sm ring-1 ring-stone-900/15",
  },
  { style: "note", name: "Label on a post-it", preview: "-rotate-3 bg-amber-200 px-1 shadow-sm" },
];

function LabelEditor({ label, onDone }: { label: Label | undefined; onDone: () => void }) {
  const engine = useEngine();
  const [text, setText] = useState(label?.text ?? "");
  const [style, setStyle] = useState<LabelStyle>(label?.style ?? "plain");
  const save = (nextStyle = style) => {
    const trimmed = text.trim();
    engine.updateSelected({ label: trimmed ? { text: trimmed, style: nextStyle } : null });
  };
  return (
    <OptionsPanel>
      <Tag size={22} weight="duotone" className="mx-2 shrink-0 text-orange-500" />
      <input
        autoFocus
        value={text}
        placeholder="Label…"
        aria-label="Label text"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            save();
            onDone();
          } else if (event.key === "Escape") {
            onDone();
          }
        }}
        className="h-10 w-36 min-w-0 rounded-xl bg-white/70 px-2 font-hand text-2xl leading-none font-semibold text-stone-800 ring-1 ring-orange-950/10 outline-none placeholder:text-stone-400 focus:ring-2 focus:ring-orange-400 md:w-48"
      />
      <Divider />
      {LABEL_STYLES.map((option) => (
        <IconButton
          compact
          key={option.style}
          label={option.name}
          active={style === option.style}
          onClick={() => {
            setStyle(option.style);
            if (text.trim()) save(option.style);
          }}
        >
          <span className={cx("font-hand text-lg leading-5", option.preview)}>Aa</span>
        </IconButton>
      ))}
      <Divider />
      <IconButton
        compact
        label="Done"
        onClick={() => {
          save();
          onDone();
        }}
        className="text-teal-600 hover:bg-teal-50"
      >
        <Check size={22} weight="bold" />
      </IconButton>
      {label && (
        <IconButton
          compact
          label="Remove label"
          onClick={() => {
            engine.updateSelected({ label: null });
            onDone();
          }}
        >
          <X size={20} weight="bold" />
        </IconButton>
      )}
    </OptionsPanel>
  );
}

/**
 * A row of choices. Shown inline from `sm` up; on phones it collapses into one
 * button showing the current choice, which opens the row in a popover.
 */
function Choices({
  label,
  current,
  children,
}: {
  label: string;
  current: ReactNode;
  children: (pick: () => void) => ReactNode;
}) {
  return (
    <>
      <div className="hidden sm:contents">{children(() => {})}</div>
      <PopoverButton label={label} trigger={current} className="sm:hidden">
        {(close) => children(close)}
      </PopoverButton>
    </>
  );
}

function InkRow({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  return (
    <Choices label="Color" current={<SwatchDot colorClass={inkColor(value).bg} />}>
      {(picked) =>
        INK.map((color) => (
          <Swatch
            key={color.key}
            label={color.name}
            colorClass={color.bg}
            active={value === color.key}
            onClick={() => {
              onChange(color.key);
              picked();
            }}
          />
        ))
      }
    </Choices>
  );
}

function PaperRow({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  return (
    <Choices label="Paper color" current={<SwatchDot colorClass={paperColor(value).bg} size="paper" />}>
      {(picked) =>
        PAPER.map((color) => (
          <Swatch
            key={color.key}
            label={color.name}
            colorClass={color.bg}
            size="paper"
            active={value === color.key}
            onClick={() => {
              onChange(color.key);
              picked();
            }}
          />
        ))
      }
    </Choices>
  );
}

const WIDTHS: { width: Width; name: string; dot: string }[] = [
  { width: "s", name: "Thin", dot: "size-1.5" },
  { width: "m", name: "Medium", dot: "size-2.5" },
  { width: "l", name: "Bold", dot: "size-4" },
];

function WidthRow({ value, onChange }: { value: Width; onChange: (width: Width) => void }) {
  const current = WIDTHS.find((option) => option.width === value) ?? WIDTHS[1]!;
  return (
    <Choices label="Line width" current={<span className={cx("rounded-full bg-current", current.dot)} />}>
      {(picked) =>
        WIDTHS.map((option) => (
          <IconButton
            compact
            key={option.width}
            label={option.name}
            active={value === option.width}
            onClick={() => {
              onChange(option.width);
              picked();
            }}
          >
            <span className={cx("rounded-full bg-current", option.dot)} />
          </IconButton>
        ))
      }
    </Choices>
  );
}

const selectClass =
  "h-10 max-w-44 min-w-0 cursor-pointer rounded-xl bg-white/70 px-2 text-sm font-medium text-stone-700 ring-1 ring-orange-950/10 outline-none focus:ring-2 focus:ring-violet-400";

/** Which board a new pin links to. */
function PinTarget() {
  const engine = useEngine();
  const boards = useStore($boards);
  const current = useStore(engine.state.$boardId);
  const target = useStore(engine.state.$pinTarget);
  const name = useStore(engine.state.$pinName);
  const others = boards.filter((b) => b.id !== current);
  const value = others.some((b) => b.id === target) ? target : "new";
  return (
    <>
      <select
        aria-label="Pin links to"
        value={value}
        onChange={(event) => engine.setPinTarget(event.target.value)}
        className={selectClass}
      >
        <option value="new">New board</option>
        {others.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      {value === "new" && (
        <input
          value={name}
          placeholder="Name, e.g. Lisbon"
          aria-label="Name of the new board"
          onChange={(event) => engine.setPinTarget("new", event.target.value)}
          className="ml-1 h-10 w-40 min-w-0 rounded-xl bg-white/70 px-2 font-hand text-xl font-semibold text-stone-800 ring-1 ring-orange-950/10 outline-none placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:text-stone-400 focus:ring-2 focus:ring-violet-400"
        />
      )}
    </>
  );
}

/** Changes which board a selected pin links to. */
function PinRetarget({ boardId }: { boardId: string }) {
  const engine = useEngine();
  const boards = useStore($boards);
  const current = useStore(engine.state.$boardId);
  const options = boards.filter((b) => b.id !== current);
  return (
    <select
      aria-label="Pin links to"
      value={boardId}
      onChange={(event) => engine.updateSelected({ boardId: event.target.value })}
      className={cx(selectClass, "mr-1")}
    >
      {!options.some((b) => b.id === boardId) && <option value={boardId}>Linked board</option>}
      {options.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  );
}
