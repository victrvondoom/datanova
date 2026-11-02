/** Shared visual vocabulary for canvas + SVG export (label + dash + color: never color alone). */
import { Category, ConnType } from "./model";

export const CONN_STYLE: Record<ConnType, { color: string; dash: string; label: string; glyph: string }> = {
  sync: { color: "#38bdf8", dash: "", label: "Synchronous request", glyph: "→" },
  async: { color: "#fb923c", dash: "8 5", label: "Asynchronous message", glyph: "⇢" },
  event: { color: "#a78bfa", dash: "2 5", label: "Event publication", glyph: "⇝" },
  data: { color: "#94a3b8", dash: "", label: "Data access", glyph: "⇒" },
  schedule: { color: "#2dd4bf", dash: "10 4 2 4", label: "Scheduled trigger", glyph: "⏱" },
};

export const CATEGORY_COLOR: Record<Category, string> = {
  entry: "#0ea5e9",
  application: "#22c55e",
  data: "#eab308",
  async: "#f97316",
  reliability: "#ef4444",
  distributed: "#a855f7",
};

export const NODE_W = 168;
export const NODE_H = 62;
