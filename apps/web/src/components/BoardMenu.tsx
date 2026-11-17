import {
  CaretDown,
  Check,
  Compass,
  DownloadSimple,
  GithubLogo,
  MapTrifold,
  PaperPlaneTilt,
  Plus,
  Trash,
  UploadSimple,
} from "@phosphor-icons/react";
import { useStore } from "@nanostores/react";
import {
  $boards,
  createBoardMeta,
  deleteBoard,
  downloadBoardFile,
  parseBoardFile,
  renameBoard,
} from "engine";
import { useRef, type ReactNode } from "react";
import { cx } from "../lib/cx.ts";
import { useEngine } from "../lib/engine.ts";
import { usePopover } from "../lib/popover.ts";
import { goToBoard } from "../lib/router.ts";
import { toast } from "../lib/toast.ts";
import { Card } from "./ui.tsx";

/** Board name, switching, new board, backup and delete. */
export function BoardMenu() {
  const engine = useEngine();
  const boards = useStore($boards);
  const boardId = useStore(engine.state.$boardId);
  const current = boards.find((b) => b.id === boardId);
  const { open, setOpen, ref } = usePopover<HTMLDivElement>();
  const fileInput = useRef<HTMLInputElement>(null);

  const switchTo = (id: string) => {
    setOpen(false);
    goToBoard(id);
  };

  const exportBackup = () => {
    const file = engine.exportBoard();
    if (!file) return;
    downloadBoardFile(file);
    toast("Backup downloaded");
    setOpen(false);
  };

  const importBackup = async (file: File | undefined) => {
    if (!file) return;
    const result = parseBoardFile(await file.text());
    if (!result.ok) return toast(result.error, "error");
    const id = await engine.importFile(result.file);
    goToBoard(id);
    setOpen(false);
    toast(
      result.skipped > 0
        ? `Imported as a new board. ${result.skipped} item(s) couldn't be read and were skipped.`
        : "Imported as a new board",
    );
  };

  const deleteCurrent = async () => {
    if (!current) return;
    if (!confirm(`Delete “${current.name}” from this device? Export a backup first if you might need it.`)) {
      return;
    }
    const next = boards.find((b) => b.id !== current.id) ?? createBoardMeta();
    // Close the board before deleting its data.
    await engine.openBoard(next.id);
    goToBoard(next.id, true);
    await deleteBoard(current.id);
    setOpen(false);
    toast(`Deleted “${current.name}”`);
  };

  return (
    <div ref={ref} className="pointer-events-auto relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex h-12 cursor-pointer items-center gap-2 rounded-2xl bg-amber-50/95 pr-3 pl-1.5 shadow-lg ring-1 shadow-orange-950/10 ring-orange-950/10 backdrop-blur-md transition hover:bg-amber-50 active:scale-[0.98]"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-linear-to-br from-orange-400 to-rose-500 text-white shadow-sm shadow-rose-600/30">
          <Compass size={22} weight="duotone" />
        </span>
        <span className="max-w-[8.5rem] truncate pr-1 font-hand text-2xl leading-none font-semibold text-stone-800 lg:max-w-[14rem]">
          {current?.name ?? "…"}
        </span>
        <CaretDown size={14} weight="bold" className="shrink-0 text-stone-400" />
      </button>

      {open && current && (
        <Card className="absolute top-14 left-0 z-20 w-[min(20rem,calc(100vw-1.5rem))]">
          <label className="block px-2 pt-1 text-[11px] font-semibold tracking-wide text-stone-500 uppercase">
            Board name
            <input
              key={`${current.id}:${current.name}`}
              defaultValue={current.name}
              onBlur={(event) => renameBoard(current.id, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              className="mt-1 block h-10 w-full rounded-xl bg-white/80 px-2.5 font-hand text-2xl font-semibold tracking-normal text-stone-800 normal-case ring-1 ring-orange-950/10 outline-none focus:ring-2 focus:ring-orange-400"
            />
          </label>

          <p className="mt-3 px-2 text-[11px] font-semibold tracking-wide text-stone-500 uppercase">
            Boards on this device
          </p>
          <ul className="no-scrollbar mt-1 max-h-56 overflow-y-auto">
            {boards.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => switchTo(b.id)}
                  className={cx(
                    "flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition hover:bg-orange-100/70",
                    b.id === current.id && "bg-orange-100",
                  )}
                >
                  <MapTrifold size={20} weight="duotone" className="shrink-0 text-sky-600" />
                  <span className="min-w-0 flex-1 truncate font-hand text-xl leading-6 font-semibold">
                    {b.name}
                  </span>
                  {b.id === current.id && <Check size={16} weight="bold" className="text-orange-600" />}
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-2 grid gap-0.5 border-t border-orange-950/10 pt-2">
            <MenuAction
              icon={<Plus size={20} weight="bold" />}
              onClick={() => switchTo(createBoardMeta().id)}
            >
              New board
            </MenuAction>
            <MenuAction icon={<DownloadSimple size={20} weight="duotone" />} onClick={exportBackup}>
              Export backup (JSON)
            </MenuAction>
            <MenuAction
              icon={<UploadSimple size={20} weight="duotone" />}
              onClick={() => fileInput.current?.click()}
            >
              Import backup as new board
            </MenuAction>
            <MenuAction
              icon={<Trash size={20} weight="duotone" />}
              onClick={() => void deleteCurrent()}
              className="text-rose-600 hover:bg-rose-100/70"
            >
              Delete this board
            </MenuAction>
          </div>
          <div className="mt-2 grid gap-0.5 border-t border-orange-950/10 pt-2">
            <a href="mailto:mapboard@bruceroettgers.eu?subject=Feedback" className={menuActionClass}>
              <span className="grid size-5 place-items-center">
                <PaperPlaneTilt size={20} weight="duotone" />
              </span>
              Feedback
            </a>
            <a
              href="https://github.com/bcye/mapboard"
              target="_blank"
              rel="noreferrer"
              className={menuActionClass}
            >
              <span className="grid size-5 place-items-center">
                <GithubLogo size={20} weight="duotone" />
              </span>
              View source on GitHub
            </a>
          </div>
          <p className="px-2 pt-2 pb-1 text-xs leading-snug text-stone-500">
            Boards are saved in this browser only. Export a backup to keep one safe.
          </p>
          <a
            href={`${import.meta.env.BASE_URL}third-party-licenses.txt`}
            target="_blank"
            rel="noreferrer"
            className="block px-2 pb-1 text-xs text-stone-400 underline-offset-2 hover:text-stone-600 hover:underline"
          >
            Open-source licenses
          </a>
        </Card>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void importBackup(file);
        }}
      />
    </div>
  );
}

const menuActionClass =
  "flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2 py-2 text-left text-sm font-medium text-stone-700 transition hover:bg-orange-100/70";

function MenuAction({
  icon,
  children,
  onClick,
  className,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button type="button" onClick={onClick} className={cx(menuActionClass, className)}>
      <span className="grid size-5 place-items-center">{icon}</span>
      {children}
    </button>
  );
}
