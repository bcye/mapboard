import { Marker, type Map as MapLibreMap } from "maplibre-gl";
import { zoomScale, type ScaleRange } from "../geo.ts";
import { inkColor, paperColor } from "../palette.ts";
import { scaleRangeFor, type Scene } from "../scene.ts";
import {
  isLine,
  type BoardElement,
  type Label,
  type LabelStyle,
  type LngLat,
  type TextSize,
} from "../types.ts";

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
  /** A label edit finished; empty text removes the label. */
  labelText(id: string, text: string, style: LabelStyle): void;
  boardName(boardId: string): string | null;
  /** The open button on a linked marker's label was pressed. */
  openBoard(boardId: string): void;
}

type EntryKind = "marker" | "note" | "line-label";

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

/** Post-it text sizes. Kept as literals so Tailwind picks them up. */
const NOTE_TEXT: Record<TextSize, string> = { s: "text-base", m: "text-xl", l: "text-3xl" };

/** Smallest and largest post-it size when resizing, in px at base size. */
const NOTE_MIN = [80, 40] as const;
const NOTE_MAX = [480, 480] as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Label look; plain labels take a darker shade of the element's color. */
function labelClasses(style: LabelStyle, color: string) {
  return style === "box"
    ? "font-hand text-xl leading-6 font-medium text-stone-800 bg-white rounded-lg px-2 py-0.5 shadow-md ring-1 ring-stone-900/10"
    : `font-hand text-2xl leading-6 font-semibold ${inkColor(color).dark} [text-shadow:0_0_2px_white,0_0_4px_white,0_0_8px_white]`;
}

/** Where a label sits: centred below markers, on the midpoint for lines. */
const LABEL_POSITION: Record<EntryKind, string> = {
  marker: "absolute left-1/2 top-full mt-0.5 -translate-x-1/2",
  note: "",
  "line-label": "",
};

/** Labels wrap at about 9rem instead of growing wide. */
const LABEL_BASE =
  "block w-max max-w-36 text-center break-words whitespace-pre-wrap select-none outline-none empty:before:opacity-50 empty:before:content-[attr(data-placeholder)]";

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

/** Palette key a label takes its color from. */
const labelColor = (element: BoardElement) => element.color;

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

/** Draws markers, post-its and all labels as MapLibre DOM Markers. */
export class PointsRenderer {
  private entries = new Map<string, Entry>();
  private interactive = false;
  /** Post-it or label being edited; its body isn't rebuilt meanwhile. */
  private editing: string | null = null;
  /** Label being edited, with the style it's drawn in until saved. */
  private labelEdit: { id: string; style: LabelStyle; placeholder: string } | null = null;
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

  /** Rebuilds markers linked to a board, e.g. after it was renamed. */
  refreshLinks() {
    for (const entry of this.entries.values()) {
      const element = this.scene.elements.get(entry.id);
      if (element?.kind === "marker" && element.boardId && this.editing !== entry.id) {
        this.renderBody(entry, element);
      }
    }
  }

  rescale(zoom: number) {
    for (const entry of this.entries.values()) this.applyScale(entry, zoom);
  }

  clear() {
    for (const entry of this.entries.values()) entry.marker.remove();
    this.entries.clear();
    this.editing = null;
    this.labelEdit = null;
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

  /** Topmost marker or post-it under a client point, within `margin` px. */
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
    if (!entry || entry.kind !== "note" || !text || this.editing) return;
    this.editInPlace(entry, text, false, () => {
      this.callbacks.noteText(id, text.innerText.replace(/\n+$/, ""));
    });
  }

  /**
   * Starts editing a marker's or line's label in place, creating it if needed.
   * Empty text shows `placeholder`; a linked marker's label starts empty.
   */
  editLabel(id: string, style: LabelStyle, placeholder = "Label…") {
    const element = this.scene.elements.get(id);
    if (!element || this.editing || (element.kind !== "marker" && !isLine(element))) return;
    this.labelEdit = { id, style, placeholder };
    const entry = this.rebuild(id);
    const node = entry?.body.querySelector<HTMLElement>("[data-label-text]");
    if (!entry || !node) {
      this.labelEdit = null;
      return;
    }
    this.editInPlace(entry, node, true, () => {
      const text = node.innerText.replace(/\s+/g, " ").trim();
      const draft = this.labelEdit ?? { style };
      this.labelEdit = null;
      this.callbacks.labelText(id, text, draft.style);
      // Redraw even if nothing changed, e.g. an empty new label.
      this.rebuild(id);
    });
  }

  /** Restyles the label being edited, without interrupting typing. */
  setLabelStyle(style: LabelStyle) {
    if (!this.labelEdit) return;
    this.labelEdit.style = style;
    const entry = this.entries.get(this.labelEdit.id);
    const element = this.scene.elements.get(this.labelEdit.id);
    const node = entry?.body.querySelector<HTMLElement>("[data-label-text]");
    if (entry && element && node) node.className = this.labelClass(entry.kind, style, labelColor(element));
  }

  /** Ends any edit in place, saving it. */
  finishEditing() {
    const active = document.activeElement;
    if (
      this.editing &&
      active instanceof HTMLElement &&
      this.entries.get(this.editing)?.root.contains(active)
    ) {
      active.blur();
    }
  }

  private editInPlace(entry: Entry, node: HTMLElement, singleLine: boolean, done: () => void) {
    this.editing = entry.id;
    entry.marker.setDraggable(false);
    entry.root.classList.add("em-editing");
    node.contentEditable = supportsPlaintextOnly ? "plaintext-only" : "true";
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    const selection = getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const keepInView = () => this.keepInView(node);
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", keepInView);
    const settle = setTimeout(keepInView, 350);

    const stop = (event: Event) => event.stopPropagation();
    const keydown = (event: KeyboardEvent) => {
      event.stopPropagation();
      if (event.key === "Escape" || (singleLine && event.key === "Enter")) {
        event.preventDefault();
        node.blur();
      }
    };
    const events = ["mousedown", "touchstart", "pointerdown", "dblclick", "click"] as const;
    for (const type of events) node.addEventListener(type, stop);
    node.addEventListener("keydown", keydown);
    node.addEventListener(
      "blur",
      () => {
        for (const type of events) node.removeEventListener(type, stop);
        node.removeEventListener("keydown", keydown);
        viewport?.removeEventListener("resize", keepInView);
        clearTimeout(settle);
        node.contentEditable = "false";
        entry.root.classList.remove("em-editing");
        this.editing = null;
        entry.marker.setDraggable(this.interactive && entry.kind !== "line-label");
        done();
      },
      { once: true },
    );
  }

  /** Pans the map so text being edited isn't hidden by the toolbars or a phone keyboard. */
  private keepInView(node: HTMLElement) {
    const viewport = window.visualViewport;
    const rect = node.getBoundingClientRect();
    const visibleTop = (viewport?.offsetTop ?? 0) + 130;
    const visibleBottom = (viewport ? viewport.offsetTop + viewport.height : window.innerHeight) - 140;
    const shift =
      rect.bottom > visibleBottom
        ? rect.bottom - visibleBottom
        : rect.top < visibleTop
          ? rect.top - visibleTop
          : 0;
    if (shift) this.map.panBy([0, shift], { duration: 200 });
  }

  /** Redraws one element from scratch. */
  private rebuild(id: string): Entry | undefined {
    const entry = this.entries.get(id);
    if (entry) entry.key = "";
    this.update([id]);
    return this.entries.get(id);
  }

  get editingId() {
    return this.editing;
  }

  private desired(element: BoardElement): { kind: EntryKind; at: LngLat; key: string } | null {
    if (isLine(element)) {
      if (!element.label?.text && this.labelEdit?.id !== element.id) return null;
      return {
        kind: "line-label",
        at: this.scene.lineMidpoint(element),
        key: JSON.stringify([element.label, element.color]),
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
    const draft = this.labelEdit?.id === element.id ? this.labelEdit : null;
    const label: Label | undefined = draft
      ? { text: element.label?.text ?? "", style: draft.style }
      : element.label;
    const color = labelColor(element);
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
        if (draft) {
          body.append(this.label(label!, "marker", color, draft.placeholder));
        } else if (element.boardId) {
          body.append(this.boardLabel(element.boardId));
        } else if (label?.text) {
          body.append(this.label(label, "marker", color));
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
          `font-hand ${NOTE_TEXT[element.textSize ?? "m"]} leading-[1.1] font-medium text-stone-800 whitespace-pre-wrap break-words outline-none empty:before:text-stone-500/70 empty:before:content-[attr(data-placeholder)]`,
        );
        text.dataset.noteText = "";
        text.dataset.placeholder = "Write something…";
        text.textContent = element.text;
        body.append(text, this.resizeHandle(element.id));
        return body;
      }
      default: {
        const body = el("relative rounded-lg");
        if (label) body.append(this.label(label, "line-label", color, draft?.placeholder));
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

  private label(label: Label, kind: EntryKind, color: string, placeholder = "Label…"): HTMLElement {
    const node = el(this.labelClass(kind, label.style, color));
    node.dataset.labelText = "";
    node.dataset.placeholder = placeholder;
    node.textContent = label.text;
    return node;
  }

  /** A linked marker's label: the board's name in a box, with a button that opens it. */
  private boardLabel(boardId: string): HTMLElement {
    const node = el(`${LABEL_BASE} ${LABEL_POSITION.marker} ${labelClasses("box", "ink")}`);
    node.dataset.boardLink = "";
    node.textContent = this.callbacks.boardName(boardId) ?? "Linked board";
    node.append(this.openButton(boardId));
    return node;
  }

  /**
   * The ↗ on a linked marker's label opens the board. Its events never reach
   * the map or the Marker, so pressing it doesn't select or drag the marker.
   */
  private openButton(boardId: string): HTMLElement {
    const button = el(
      "relative -my-1 -mr-1.5 ml-0.5 inline-grid cursor-pointer after:absolute after:-inset-1.5 place-items-center rounded-md p-1 align-[-3px] text-stone-500 transition hover:bg-violet-100 hover:text-violet-600 active:scale-90",
      "button",
    );
    button.setAttribute("type", "button");
    button.title = "Open board in a new tab";
    button.setAttribute("aria-label", "Open board in a new tab");
    button.append(
      svg(
        `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>`,
      ),
    );
    const stop = (event: Event) => event.stopPropagation();
    for (const type of ["mousedown", "touchstart", "pointerdown", "dblclick"] as const) {
      button.addEventListener(type, stop);
    }
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      event.preventDefault();
      this.callbacks.openBoard(boardId);
    });
    return button;
  }

  private labelClass(kind: EntryKind, style: LabelStyle, color: string) {
    return `${LABEL_BASE} ${LABEL_POSITION[kind]} ${labelClasses(style, color)}`;
  }

  private toggle(id: string | null, classes: string[], on: boolean) {
    if (!id) return;
    const body = this.entries.get(id)?.body;
    if (on) body?.classList.add(...classes);
    else body?.classList.remove(...classes);
  }
}
