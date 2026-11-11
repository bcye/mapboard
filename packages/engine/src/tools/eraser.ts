import type { ScreenPoint, Tool, ToolContext } from "./context.ts";

/** Tap or drag across elements; everything touched is removed on release, as one undo step. */
export function createEraserTool(ctx: ToolContext): Tool {
  let pointer: number | null = null;
  let last: ScreenPoint | null = null;
  const hits = new Set<string>();

  const test = (p: ScreenPoint) => {
    const rect = ctx.map.getContainer().getBoundingClientRect();
    const point = ctx.points.hitTest(rect.left + p.x, rect.top + p.y, 4);
    // Points sit above lines, so touching one doesn't reach a line under it.
    if (point) hits.add(point);
    else for (const id of ctx.lines.hitTest(p.x, p.y, 8)) hits.add(id);
  };

  const preview = () => {
    ctx.points.setErasing(hits);
    ctx.lines.setErasing(hits);
  };

  const reset = () => {
    pointer = null;
    last = null;
    hits.clear();
    preview();
  };

  return {
    pointerDown(event, p) {
      if (pointer !== null) return reset();
      if (event.pointerType === "mouse" && event.button !== 0) return;
      pointer = event.pointerId;
      last = p;
      test(p);
      preview();
    },
    pointerMove(event, p) {
      if (event.pointerId !== pointer || !last) return;
      // Sample along the movement so fast swipes don't skip thin lines.
      const steps = Math.max(1, Math.ceil(Math.hypot(p.x - last.x, p.y - last.y) / 6));
      for (let i = 1; i <= steps; i++) {
        test({ x: last.x + ((p.x - last.x) * i) / steps, y: last.y + ((p.y - last.y) * i) / steps });
      }
      last = p;
      preview();
    },
    pointerUp(event) {
      if (event.pointerId !== pointer) return;
      if (hits.size > 0) ctx.board()?.remove([...hits]);
      reset();
    },
    cancel: reset,
    deactivate: reset,
  };
}
