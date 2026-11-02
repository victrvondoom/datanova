import type { ViewType } from "./Sidebar";

/** Compact list used by the small-screen view switcher in App (the sidebar is hidden below `md`). */
export const VIEW_OPTIONS: Array<{ id: ViewType; label: string }> = [
  { id: "mission", label: "Mission Control" }, { id: "stream", label: "Live Digital Twin" }, { id: "graph", label: "Fraud Network Graph" },
  { id: "decision", label: "Decision Intelligence" }, { id: "benchmark", label: "ML Benchmarks" }, { id: "drift", label: "Drift & Stress Lab" },
  { id: "explain", label: "Explainability Explorer" }, { id: "research", label: "Evidence & Research" }, { id: "trail", label: "Vibe Coding Trail" },
  { id: "studio", label: "Architecture Studio" },
];
