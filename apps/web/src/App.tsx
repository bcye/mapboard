import { useStore } from "@nanostores/react";
import { $boards, createEngine, type Engine } from "engine";
import { useEffect, useRef, useState } from "react";
import { BoardMenu } from "./components/BoardMenu.tsx";
import { HistoryControls, StylePicker, ZoomControls } from "./components/MapControls.tsx";
import { BoardLinkHint, EmptyHint, Toasts } from "./components/Notices.tsx";
import { Toolbar } from "./components/Toolbar.tsx";
import { ToolOptions } from "./components/ToolOptions.tsx";
import { EngineContext, mapStyles } from "./lib/engine.ts";
import { boardUrl, rememberBoard, useBoardId } from "./lib/router.ts";

export function App() {
  const host = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<Engine | null>(null);
  const boardId = useBoardId();

  // The engine owns the map and never re-renders through React.
  useEffect(() => {
    const instance = createEngine(host.current!, { styles: mapStyles, boardUrl });
    setEngine(instance);
    return () => {
      instance.destroy();
      setEngine(null);
    };
  }, []);

  useEffect(() => {
    if (!engine || !boardId) return;
    rememberBoard(boardId);
    void engine.openBoard(boardId);
  }, [engine, boardId]);

  return (
    <div className="fixed inset-0">
      {/* MapLibre makes its container position: relative, so size it from a wrapper. */}
      <div className="absolute inset-0">
        <div ref={host} className="h-full w-full" />
      </div>
      {engine && (
        <EngineContext value={engine}>
          <Overlay />
        </EngineContext>
      )}
    </div>
  );
}

function Overlay() {
  useDocumentTitle();
  useKeyboardInset();
  return (
    <>
      <EmptyHint />
      <BoardLinkHint />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3">
        <BoardMenu />
        <div className="flex gap-2">
          <div className="md:hidden">
            <HistoryControls />
          </div>
          <StylePicker />
        </div>
      </div>

      {/* Mode toolbar plus its options toolbar: top centre on desktop, bottom on phones (above the keyboard). */}
      <div className="pointer-events-none absolute inset-x-0 bottom-(--keyboard-inset,0px) z-10 flex flex-col-reverse items-center gap-2 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:top-0 md:bottom-auto md:flex-col md:pt-3 md:pb-0">
        <div className="pointer-events-auto">
          <Toolbar />
        </div>
        <div className="pointer-events-auto max-w-full">
          <ToolOptions />
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 z-10 hidden md:block">
        <div className="pointer-events-auto">
          <HistoryControls />
        </div>
      </div>
      <div className="pointer-events-none absolute right-3 bottom-10 z-10 hidden md:block">
        <div className="pointer-events-auto">
          <ZoomControls />
        </div>
      </div>

      <Toasts />
    </>
  );
}

function useDocumentTitle() {
  const boards = useStore($boards);
  const boardId = useBoardId();
  const name = boards.find((b) => b.id === boardId)?.name;
  useEffect(() => {
    document.title = name ? `${name} · Map board` : "Map board";
  }, [name]);
}

/**
 * Height of an on-screen keyboard covering the page, as `--keyboard-inset`.
 * Browsers that resize the page for the keyboard report 0.
 */
function useKeyboardInset() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      document.documentElement.style.setProperty("--keyboard-inset", `${Math.round(inset)}px`);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);
}
