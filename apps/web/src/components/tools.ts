import {
  ArrowBendUpRight,
  Cursor,
  Eraser,
  MapPin,
  Note,
  PushPin,
  ScribbleLoop,
  type Icon,
  type IconWeight,
} from "@phosphor-icons/react";
import type { ToolId } from "engine";

interface ToolMeta {
  label: string;
  Icon: Icon;
  /** Classes for the idle and active button. Literal strings so Tailwind sees them. */
  idle: string;
  active: string;
  /** Icon weight when active. Defaults to "fill"; line-only icons render as a filled box with it. */
  activeWeight?: IconWeight;
}

export const TOOL_META: Record<ToolId, ToolMeta> = {
  select: {
    label: "Select and move",
    Icon: Cursor,
    idle: "text-teal-600 hover:bg-teal-50",
    active: "bg-teal-500 text-white shadow-md shadow-teal-600/30",
  },
  draw: {
    label: "Draw",
    Icon: ScribbleLoop,
    idle: "text-rose-500 hover:bg-rose-50",
    active: "bg-rose-500 text-white shadow-md shadow-rose-600/30",
    activeWeight: "bold",
  },
  arrow: {
    label: "Arrow",
    Icon: ArrowBendUpRight,
    idle: "text-sky-600 hover:bg-sky-50",
    active: "bg-sky-500 text-white shadow-md shadow-sky-600/30",
  },
  marker: {
    label: "Marker",
    Icon: MapPin,
    idle: "text-orange-500 hover:bg-orange-50",
    active: "bg-orange-500 text-white shadow-md shadow-orange-600/30",
  },
  note: {
    label: "Post-it",
    Icon: Note,
    idle: "text-amber-600 hover:bg-amber-100",
    active: "bg-amber-400 text-stone-900 shadow-md shadow-amber-600/30",
  },
  pin: {
    label: "Board pin",
    Icon: PushPin,
    idle: "text-violet-600 hover:bg-violet-50",
    active: "bg-violet-500 text-white shadow-md shadow-violet-600/30",
  },
  eraser: {
    label: "Eraser",
    Icon: Eraser,
    idle: "text-pink-500 hover:bg-pink-50",
    active: "bg-pink-500 text-white shadow-md shadow-pink-600/30",
  },
};
