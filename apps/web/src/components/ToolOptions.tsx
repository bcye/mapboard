import {
  ArrowSquareOut,
  Check,
  LinkSimple,
  LinkSimpleBreak,
  PencilSimpleLine,
  Plus,
  StackPlus,
  Tag,
  Trash,
} from "@phosphor-icons/react";
import { useStore } from "@nanostores/react";
import {
  $boards,
  INK,
  PAPER,
  inkColor,
  paperColor,
  type BoardElement,
  type LabelStyle,
  type ToolId,
  type Width,
} from "engine";
import type { MouseEvent, ReactNode } from "react";
import { cx } from "../lib/cx.ts";
import { useEngine } from "../lib/engine.ts";
import { boardUrl } from "../lib/router.ts";
import { Divider, IconButton, Panel, PopoverButton, Swatch, SwatchDot, TextButton } from "./ui.tsx";

/** Second toolbar: settings for the active tool, or for the selected element. */
export function ToolOptions() {
  const engine = useEngine();
  const tool = useStore(engine.state.$tool);
  const selected = useStore(engine.state.$selected);
  const labelDraft = useStore(engine.state.$labelDraft);
  if (labelDraft && selected?.id === labelDraft.id) {
    return labelDraft.purpose === "board" ? (
      <BoardNameBar />
    ) : (
      <LabelStyleBar style={labelDraft.style} color={selected.color} />
    );
  }
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
    </OptionsPanel>
  );
}

function SelectionOptions({ element }: { element: BoardElement }) {
  const engine = useEngine();
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
      {element.kind === "marker" && element.boardId && <BoardLinkActions boardId={element.boardId} />}
      {(isLine || (element.kind === "marker" && !element.boardId)) && (
        <IconButton
          compact
          label={element.label ? "Edit label" : "Add label"}
          onClick={() => engine.editSelectedLabel()}
        >
          <Tag size={22} weight="duotone" className="text-orange-500" />
        </IconButton>
      )}
      {element.kind === "marker" && !element.boardId && <OwnBoardButton />}
      <Divider />
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

/** While a label is edited on the map: its style, and done. */
function LabelStyleBar({ style, color }: { style: LabelStyle; color: string }) {
  const engine = useEngine();
  // Buttons keep focus in the label, so typing isn't interrupted.
  const keepFocus = (event: MouseEvent) => event.preventDefault();
  return (
    <OptionsPanel>
      <IconButton
        compact
        label="Plain label"
        active={style === "plain"}
        onMouseDown={keepFocus}
        onClick={() => engine.setLabelStyle("plain")}
      >
        <span
          className={cx(
            "font-hand text-xl leading-5 font-semibold [text-shadow:0_0_2px_white]",
            inkColor(color).dark,
          )}
        >
          Aa
        </span>
      </IconButton>
      <IconButton
        compact
        label="Label in a box"
        active={style === "box"}
        onMouseDown={keepFocus}
        onClick={() => engine.setLabelStyle("box")}
      >
        <span className="rounded-md bg-white px-1 font-hand text-lg leading-5 font-medium text-stone-800 shadow-sm ring-1 ring-stone-900/15">
          Aa
        </span>
      </IconButton>
      <Divider />
      <IconButton
        compact
        label="Done"
        onMouseDown={keepFocus}
        onClick={() => engine.finishEditing()}
        className="text-teal-600 hover:bg-teal-50"
      >
        <Check size={22} weight="bold" />
      </IconButton>
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

/** Boards a marker on this board can link to. */
function useLinkableBoards() {
  const engine = useEngine();
  const boards = useStore($boards);
  const current = useStore(engine.state.$boardId);
  return boards.filter((b) => b.id !== current);
}

/**
 * Gives an unlinked marker a board: pick an existing one, or make a new one.
 * With no other boards to pick from, it makes a new one straight away.
 */
function OwnBoardButton() {
  const engine = useEngine();
  const others = useLinkableBoards();
  const content = (
    <>
      <StackPlus size={20} weight="duotone" className="text-violet-600" />
      Own board
    </>
  );
  if (others.length === 0) {
    return (
      <TextButton
        label="Plan this place on a board of its own"
        onClick={() => engine.linkSelectedToNewBoard()}
      >
        {content}
      </TextButton>
    );
  }
  return (
    <PopoverButton menu text label="Plan this place on a board of its own" trigger={content}>
      {(close) => <LinkMenu close={close} />}
    </PopoverButton>
  );
}

/** A linked marker: open its board, or change or remove the link. */
function BoardLinkActions({ boardId }: { boardId: string }) {
  return (
    <>
      <TextButton
        label="Open the linked board in a new tab"
        onClick={() => window.open(boardUrl(boardId), "_blank", "noopener")}
      >
        <ArrowSquareOut size={20} weight="duotone" className="text-violet-600" />
        Open
      </TextButton>
      <PopoverButton menu label="Linked board" trigger={<LinkSimple size={22} weight="duotone" />}>
        {(close) => <LinkMenu close={close} linked={boardId} />}
      </PopoverButton>
    </>
  );
}

/** Pick a board for the selected marker, make a new one, or unlink it if `linked`. */
function LinkMenu({ close, linked }: { close: () => void; linked?: string }) {
  const engine = useEngine();
  const others = useLinkableBoards();
  const item =
    "flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-sm font-medium transition hover:bg-orange-100/70";
  return (
    <>
      <p className="px-2 pt-1 pb-1.5 text-[11px] font-semibold tracking-wide text-stone-500 uppercase">
        Links to
      </p>
      <div className="max-h-56 overflow-y-auto">
        {others.map((b) => (
          <button
            key={b.id}
            type="button"
            role="menuitemradio"
            aria-checked={b.id === linked}
            onClick={() => {
              engine.linkSelected(b.id);
              close();
            }}
            className={cx(item, b.id === linked && "bg-orange-100")}
          >
            <span className="flex-1 truncate">{b.name}</span>
            {b.id === linked && <Check size={16} weight="bold" className="text-orange-600" />}
          </button>
        ))}
      </div>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          close();
          engine.linkSelectedToNewBoard();
        }}
        className={item}
      >
        <Plus size={16} weight="bold" className="text-violet-600" />
        New board…
      </button>
      {linked && (
        <>
          <div className="mx-2 my-1 h-px bg-orange-950/10" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              engine.unlinkSelected();
            }}
            className={item}
          >
            <LinkSimpleBreak size={16} weight="bold" className="text-stone-500" />
            Unlink
          </button>
        </>
      )}
    </>
  );
}

/** While naming a new board on the map. */
function BoardNameBar() {
  const engine = useEngine();
  return (
    <OptionsPanel>
      <span className="flex items-center gap-1.5 px-2 text-sm font-semibold text-stone-600">
        <StackPlus size={20} weight="duotone" className="text-violet-600" />
        New board
      </span>
      <Divider />
      <IconButton
        compact
        label="Done"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => engine.finishEditing()}
        className="text-teal-600 hover:bg-teal-50"
      >
        <Check size={22} weight="bold" />
      </IconButton>
    </OptionsPanel>
  );
}
