import "@fontsource-variable/caveat";
import "./index.css";
import { $boards, createBoardMeta } from "engine";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { goToBoard, lastBoardId } from "./lib/router.ts";

// Open a board before the first render: the last one used, the newest, or a new one.
if (!location.hash.startsWith("#/board/")) {
  const boards = $boards.get();
  const last = lastBoardId();
  const board = boards.find((b) => b.id === last) ?? boards[0] ?? createBoardMeta();
  goToBoard(board.id, true);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
