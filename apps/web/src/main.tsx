import "@fontsource-variable/caveat";
import { init } from "@plausible-analytics/tracker";
import { $boards, createBoardMeta } from "engine";
// After the engine, so our CSS comes after MapLibre's and overrides it.
import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { goToBoard, lastBoardId } from "./lib/router.ts";

// Privacy-friendly analytics by Plausible
init({
  domain: "mapboard.bruceroettgers.eu",
  endpoint: "https://p-proxy-tp8ez.bunny.run/api/event",
  outboundLinks: true,
});

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
