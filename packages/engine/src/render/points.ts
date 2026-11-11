import { Marker, type Map as MapLibreMap } from "maplibre-gl";
import { zoomScale, type ScaleRange } from "../geo.ts";
import { inkColor, paperColor } from "../palette.ts";
import { scaleRangeFor, type Scene } from "../scene.ts";
import { isLine, type BoardElement, type Label, type LngLat } from "../types.ts";

export interface PointCallbacks {
  click(id: string, event: MouseEvent): void;
  doubleClick(id: string): void;
  dragStart(id: string): void;
  drag(id: string, at: LngLat): void;
  dragEnd(id: string, at: LngLat): void;
  /** A post-it is being resized; `at` is its new centre. */
  resize(id: string, at: LngLat): void;
  resizeEnd(id: string, at: LngLat, size: [width: number, height: number]): void;
  noteText(id: string, text: string): void;
  boardName(boardId: string): string | null;
}

type EntryKind = "marker" | "note" | "pin" | "line-label";

interface Entry {
  id: string;
  kind: EntryKind;
  marker: Marker;
  root: HTMLElement;
  scale: HTMLElement;
  body: HTMLElement;
  range: ScaleRange;
  /** Zoom scale currently applied. */
  scaleValue: number;
  /** Serialized visual state; the body is only rebuilt when it changes. */
  key: string;
  dragged: boolean;
}

// Class lists toggled at runtime. Kept as literals so Tailwind picks them up.
const SELECTED = ["outline-2", "outline-dashed", "outline-offset-4", "outline-teal-500"];
const SNAP_TARGET = ["outline-3", "outline-offset-4", "outline-sky-400"];
const ERASING = ["opacity-30"];

/** Smallest and largest post-it size when resizing, in px at base size. */
const NOTE_MIN = [80, 40] as const;
const NOTE_MAX = [480, 480] as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const LABEL_CLASSES: Record<Label["style"], string> = {
  plain:
    "font-hand text-2xl leading-6 font-semibold text-stone-800 [text-shadow:0_0_2px_white,0_0_4px_white,0_0_8px_white]",
  box: "font-hand text-xl leading-6 font-medium text-stone-800 bg-white rounded-lg px-2 py-0.5 shadow-md ring-1 ring-stone-900/10",
  note: "font-hand text-xl leading-6 font-medium text-stone-800 bg-amber-200 px-2.5 py-1 shadow-md -rotate-2",
};

const svg = (markup: string) => {
  const template = document.createElement("template");
  template.innerHTML = markup.trim();
  return template.content.firstElementChild as SVGElement;
};

const el = (className: string, tag = "div") => {
  const node = document.createElement(tag);
  node.className = className;
  return node;
};

/** Small stable number from an id, for a little per-note tilt. */
function tilt(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return (Math.abs(hash) % 7) - 3;
}

const supportsPlaintextOnly = (() => {
  if (typeof document === "undefined") return false;
  const probe = document.createElement("div");
  probe.contentEditable = "plaintext-only";
  return probe.contentEditable === "plaintext-only";
})();

/** Draws markers, post-its, board pins and all labels as MapLibre DOM Markers. */
export class PointsRenderer {
  private entries = new Map<string, Entry>();
  private interactive = false;
  private editing: string | null = null;
  private selected: string | null = null;
  private snapTarget: string | null = null;
  private erasing = new Set<string>();

  private map: MapLibreMap;
  private scene: Scene;
  private callbacks: PointCallbacks;

  constructor(map: MapLibreMap, scene: Scene, callbacks: PointCallbacks) {
    this.map = map;
    this.scene = scene;
    this.callbacks = callbacks;
    scene.sizeOf = (id) => {
      const entry = this.entries.get(id);
      return entry ? { width: entry.body.offsetWidth, height: entry.body.offsetHeight } : null;
    };
  }

  /** Redraws these elements; ids of lines update their labels. */
  update(ids: Iterable<string>) {
    for (const id of ids) {
      const element = this.scene.elements.get(id);
      const want = element ? this.desired(element) : null;
      const entry = this.entries.get(id);
      if (!want || !element) {
        if (entry) this.remove(entry);
        continue;
      }
      if (entry && entry.kind !== want.kind) this.remove(entry);
      const current = this.entries.get(id) ?? this.create(id, want.kind);
      current.marker.setLngLat(want.at);
      current.root.style.zIndex = String(this.scene.rank(id));
      if (current.key !== want.key && this.editing !== id) {
        current.key = want.key;
        this.renderBody(current, element);
      }
    }
  }

  /** Moves a point (or a line's label) while dragging, without a rebuild. */
  preview(ids: Iterable<string>) {
    for (const id of ids) {
      const entry = this.entries.get(id);
      const element = this.scene.elements.get(id);
      if (!entry || !element) continue;
      const at = isLine(element) ? this.scene.lineMidpoint(element) : this.scene.positionOf(id);
      if (at) entry.marker.setLngLat(at);
    }
  }

  /** Rebuilds pins, e.g. after a linked board was renamed. */
  refreshPins() {
    for (const entry of this.entries.values()) {
      if (entry.kind !== "pin") continue;
      const element = this.scene.elements.get(entry.id);
      if (element) this.renderBody(entry, element);
    }
  }

  rescale(zoom: number) {
    for (const entry of this.entries.values()) this.applyScale(entry, zoom);
  }

  clear() {
    for (const entry of this.entries.values()) entry.marker.remove();
    this.entries.clear();
    this.editing = null;
    this.selected = null;
    this.snapTarget = null;
    this.erasing.clear();
  }

  /** Point elements can be clicked and dragged (select tool only). */
  setInteractive(interactive: boolean) {
    this.interactive = interactive;
    for (const entry of this.entries.values()) {
      entry.marker.setDraggable(interactive && entry.kind !== "line-label" && this.editing !== entry.id);
    }
  }

  setSelected(id: string | null) {
    this.toggle(this.selected, SELECTED, false);
    if (this.selected) this.entries.get(this.selected)?.root.classList.remove("em-selected");
    this.selected = id;
    this.toggle(id, SELECTED, true);
    if (id) this.entries.get(id)?.root.classList.add("em-selected");
  }

  setSnapTarget(id: string | null) {
    if (id === this.snapTarget) return;
    this.toggle(this.snapTarget, SNAP_TARGET, false);
    this.snapTarget = id;
    this.toggle(id, SNAP_TARGET, true);
  }

  setErasing(ids: Set<string>) {
    for (const id of this.erasing) if (!ids.has(id)) this.toggle(id, ERASING, false);
    for (const id of ids) this.toggle(id, ERASING, true);
    this.erasing = new Set(ids);
  }

  /** Topmost marker, post-it or pin under a client point, within `margin` px. */
  hitTest(clientX: number, clientY: number, margin: number): string | null {
    let best: Entry | null = null;
    for (const entry of this.entries.values()) {
      if (entry.kind === "line-label") continue;
      const r = entry.body.getBoundingClientRect();
      const inside =
        clientX >= r.left - margin &&
        clientX <= r.right + margin &&
        clientY >= r.top - margin &&
        clientY <= r.bottom + margin;
      if (inside && (!best || this.scene.rank(entry.id) > this.scene.rank(best.id))) best = entry;
    }
    return best?.id ?? null;
  }

  /** Starts editing a post-it's text in place. */
  editNote(id: string) {
    const entry = this.entries.get(id);
    const text = entry?.body.querySelector<HTMLElement>("[data-note-text]");
    if (!entry || entry.kind !== "note" || !text || this.editing === id) return;
    this.editing = id;
    entry.marker.setDraggable(false);
    entry.root.classList.add("em-editing");
    text.contentEditable = supportsPlaintextOnly ? "plaintext-only" : "true";
    text.focus();
    const range = document.createRange();
    range.selectNodeContents(text);
    range.collapse(false);
    const selection = getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const stop = (event: Event) => event.stopPropagation();
    const keydown = (event: KeyboardEvent) => {
      event.stopPropagation();
      if (event.key === "Escape") text.blur();
    };
    const events = ["mousedown", "touchstart", "pointerdown", "dblclick", "click"] as const;
    for (const type of events) text.addEventListener(type, stop);
    text.addEventListener("keydown", keydown);
    text.addEventListener(
      "blur",
      () => {
        for (const type of events) text.removeEventListener(type, stop);
        text.removeEventListener("keydown", keydown);
        text.contentEditable = "false";
        entry.root.classList.remove("em-editing");
        this.editing = null;
        entry.marker.setDraggable(this.interactive);
        this.callbacks.noteText(id, text.innerText.replace(/\n+$/, ""));
      },
      { once: true },
    );
  }

  get editingId() {
    return this.editing;
  }

  private desired(element: BoardElement): { kind: EntryKind; at: LngLat; key: string } | null {
    if (isLine(element)) {
      if (!element.label?.text) return null;
      return {
        kind: "line-label",
        at: this.scene.lineMidpoint(element),
        key: JSON.stringify(element.label),
      };
    }
    const at = this.scene.positionOf(element.id) ?? element.at;
    const { id: _id, order: _order, at: _at, ...visual } = element;
    return { kind: element.kind, at, key: JSON.stringify(visual) };
  }

  private create(id: string, kind: EntryKind): Entry {
    const root = el("em-point");
    root.dataset.id = id;
    const scale = el("em-scale");
    scale.style.transformOrigin = kind === "marker" ? "50% 100%" : "50% 50%";
    const body = el("");
    scale.append(body);
    root.append(scale);
    const marker = new Marker({
      element: root,
      anchor: kind === "marker" ? "bottom" : "center",
      subpixelPositioning: true,
    });
    const entry: Entry = {
      id,
      kind,
      marker,
      root,
      scale,
      body,
      range: scaleRangeFor(kind),
      scaleValue: 0,
      key: "",
      dragged: false,
    };
    marker.setLngLat([0, 0]).addTo(this.map);
    marker.setDraggable(this.interactive && kind !== "line-label");
    if (this.selected === id) root.classList.add("em-selected");
    marker.on("dragstart", () => {
      entry.dragged = true;
      this.callbacks.dragStart(id);
    });
    marker.on("drag", () => {
      const p = marker.getLngLat();
      this.callbacks.drag(id, [p.lng, p.lat]);
    });
    marker.on("dragend", () => {
      const p = marker.getLngLat();
      this.callbacks.dragEnd(id, [p.lng, p.lat]);
      // The click that follows a drag isn't a click.
      setTimeout(() => (entry.dragged = false), 0);
    });
    root.addEventListener("click", (event) => {
      if (entry.dragged) return;
      this.callbacks.click(id, event);
    });
    root.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.callbacks.doubleClick(id);
    });
    this.entries.set(id, entry);
    this.applyScale(entry, this.map.getZoom());
    return entry;
  }

  private applyScale(entry: Entry, zoom: number) {
    const value = zoomScale(zoom, entry.range);
    // Mostly clamped, so most zoom events change nothing.
    if (value === entry.scaleValue) return;
    entry.scaleValue = value;
    entry.scale.style.transform = `scale(${value})`;
  }

  /**
   * Resizes a post-it from its corner handle. The top-left corner stays put,
   * the text keeps its size, and the height never goes below the text's.
   */
  private startResize(entry: Entry, handle: HTMLElement, event: PointerEvent) {
    if (event.button !== 0) return;
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      // Best-effort, as for drawing.
    }
    const { body, marker } = entry;
    const scale = entry.scaleValue;
    const start = { x: event.clientX, y: event.clientY, width: body.offsetWidth, height: body.offsetHeight };
    const center = this.map.project(marker.getLngLat());
    const left = center.x - (start.width * scale) / 2;
    const top = center.y - (start.height * scale) / 2;
    let result: { at: LngLat; size: [number, number] } | null = null;

    const move = (e: PointerEvent) => {
      if (e.pointerId !== event.pointerId) return;
      const width = Math.round(clamp(start.width + (e.clientX - start.x) / scale, NOTE_MIN[0], NOTE_MAX[0]));
      const minHeight = clamp(start.height + (e.clientY - start.y) / scale, NOTE_MIN[1], NOTE_MAX[1]);
      body.style.width = `${width}px`;
      body.style.minHeight = `${Math.round(minHeight)}px`;
      const height = body.offsetHeight;
      const p = this.map.unproject([left + (width * scale) / 2, top + (height * scale) / 2]);
      result = { at: [p.lng, p.lat], size: [width, height] };
      marker.setLngLat(result.at);
      this.callbacks.resize(entry.id, result.at);
    };
    const end = (e: PointerEvent) => {
      if (e.pointerId !== event.pointerId) return;
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      if (result) this.callbacks.resizeEnd(entry.id, result.at, result.size);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }

  private remove(entry: Entry) {
    entry.marker.remove();
    this.entries.delete(entry.id);
    if (this.editing === entry.id) this.editing = null;
  }

  private renderBody(entry: Entry, element: BoardElement) {
    const body = this.buildBody(element);
    entry.body.replaceWith(body);
    entry.body = body;
    if (this.selected === entry.id) body.classList.add(...SELECTED);
    if (this.snapTarget === entry.id) body.classList.add(...SNAP_TARGET);
    if (this.erasing.has(entry.id)) body.classList.add(...ERASING);
  }

  private buildBody(element: BoardElement): HTMLElement {
    switch (element.kind) {
      case "marker": {
        const body = el("relative h-10 w-[30px] rounded-lg");
        body.append(
          svg(
            `<svg viewBox="0 0 30 40" width="30" height="40" class="${inkColor(element.color).text} drop-shadow-[0_2px_2px_rgb(0_0_0/0.35)]">
              <path d="M15 38.5C15 38.5 3 24.2 3 14.8a12 12 0 0 1 24 0C27 24.2 15 38.5 15 38.5Z" fill="currentColor" stroke="white" stroke-width="2.5" stroke-linejoin="round"/>
              <circle cx="15" cy="14.8" r="4.6" fill="white"/>
            </svg>`,
          ),
        );
        if (element.label?.text) {
          body.append(this.label(element.label, "absolute left-full top-[15px] ml-1 -translate-y-1/2"));
        }
        return body;
      }
      case "note": {
        const body = el(
          `relative w-36 min-h-18 rounded-[3px] px-3 pt-3 pb-2.5 shadow-lg shadow-stone-900/20 ${paperColor(element.color).bg}`,
        );
        if (element.size) {
          body.style.width = `${element.size[0]}px`;
          body.style.minHeight = `${element.size[1]}px`;
        }
        body.style.rotate = `${tilt(element.id)}deg`;
        // A strip of washi tape holding the note to the map.
        body.append(el("absolute -top-2 left-1/2 h-4 w-12 -translate-x-1/2 rotate-3 bg-white/55 shadow-sm"));
        const text = el(
          "font-hand text-xl leading-[1.1] font-medium text-stone-800 whitespace-pre-wrap break-words outline-none empty:before:text-stone-500/70 empty:before:content-[attr(data-placeholder)]",
        );
        text.dataset.noteText = "";
        text.dataset.placeholder = "Write something…";
        text.textContent = element.text;
        body.append(text, this.resizeHandle(element.id));
        if (element.label?.text) {
          body.append(this.label(element.label, "absolute left-1/2 top-full mt-2 -translate-x-1/2"));
        }
        return body;
      }
      case "pin": {
        const ink = inkColor(element.color);
        const body = el(
          `relative flex items-center gap-2 rounded-2xl bg-white py-1.5 pr-3 pl-1.5 shadow-lg shadow-stone-900/20 ring-2 ring-current cursor-pointer ${ink.text}`,
        );
        const badge = el("grid size-7 shrink-0 place-items-center rounded-full bg-current");
        badge.append(
          svg(
            `<svg viewBox="0 0 24 24" width="16" height="16" class="text-white"><circle cx="12" cy="8.5" r="5.5" fill="currentColor"/><path d="M12 14v7.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`,
          ),
        );
        const name = el("max-w-44 truncate font-hand text-[22px] leading-6 font-semibold text-stone-800");
        name.textContent = this.callbacks.boardName(element.boardId) ?? "Linked board";
        const open = svg(
          `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-stone-400"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>`,
        );
        body.append(badge, name, open);
        if (element.label?.text) {
          body.append(this.label(element.label, "absolute left-1/2 top-full mt-2 -translate-x-1/2"));
        }
        return body;
      }
      default: {
        const body = el("relative rounded-lg");
        if (element.label) body.append(this.label(element.label, ""));
        return body;
      }
    }
  }

  /** Corner grip for resizing a selected post-it. Its events never reach the map or the Marker. */
  private resizeHandle(id: string): HTMLElement {
    const handle = el("em-resize absolute -right-2 -bottom-2 size-8 cursor-nwse-resize touch-none");
    handle.append(
      svg(
        `<svg viewBox="0 0 12 12" width="12" height="12" class="absolute top-2.5 left-2.5 text-stone-600/60"><path d="M10.5 3.5l-7 7M10.5 7.5l-3 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
      ),
    );
    const stop = (event: Event) => event.stopPropagation();
    for (const type of ["mousedown", "touchstart", "click", "dblclick"] as const) {
      handle.addEventListener(type, stop);
    }
    handle.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      // Keeps focus (and editing) on the text, and stops the mouse events that start a drag.
      event.preventDefault();
      const entry = this.entries.get(id);
      if (entry) this.startResize(entry, handle, event);
    });
    return handle;
  }

  private label(label: Label, position: string): HTMLElement {
    const node = el(`whitespace-nowrap select-none ${position} ${LABEL_CLASSES[label.style]}`);
    node.textContent = label.text;
    return node;
  }

  private toggle(id: string | null, classes: string[], on: boolean) {
    if (!id) return;
    const body = this.entries.get(id)?.body;
    if (on) body?.classList.add(...classes);
    else body?.classList.remove(...classes);
  }
}
