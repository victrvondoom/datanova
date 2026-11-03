/**
 * Hash router for the Architecture Intelligence Lab (#/lab/<tab>) — same
 * refresh-safe pattern as the trail router, no react-router dependency.
 */
import { useEffect, useState } from "react";

export const LAB_TABS = [
  "overview", "causality", "reasoning", "data", "security",
  "experiments", "review", "capstone",
] as const;

export type LabTab = (typeof LAB_TABS)[number];

export const TAB_LABELS: Record<LabTab, string> = {
  overview: "Architecture & Intent",
  causality: "Causality & Blast Radius",
  reasoning: "Capacity & Latency",
  data: "Data & Workflows",
  security: "Security & Trust",
  experiments: "Experiments & Recorder",
  review: "Critic & Missions",
  capstone: "Capstone & Benchmark",
};

export function parseLabHash(hash: string): LabTab {
  const clean = hash.replace(/^#\/?/, "");
  const parts = clean.split("/").filter(Boolean);
  if (parts[0] !== "lab") return "overview";
  const tab = parts[1] as LabTab;
  return LAB_TABS.includes(tab) ? tab : "overview";
}

export function labTabHash(tab: LabTab): string {
  return `#/lab/${tab}`;
}

export function useLabTab(): [LabTab, (t: LabTab) => void] {
  const [tab, setTab] = useState<LabTab>(() => parseLabHash(window.location.hash));
  useEffect(() => {
    const onHashChange = () => setTab(parseLabHash(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  const navigate = (t: LabTab) => {
    window.location.hash = labTabHash(t);
    setTab(t);
  };
  return [tab, navigate];
}
