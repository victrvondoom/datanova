/**
 * Datanova Atlas — hash router (#/atlas/<section>) — same refresh-safe
 * pattern as the trail and lab routers, no router dependency.
 */

import { useEffect, useState } from "react";

export const ATLAS_SECTIONS = [
  "mission", "reality", "studio", "experiments", "validation", "exchange",
  "benchmarks", "sources", "decisions", "settings", "system", "agents",
] as const;

export type AtlasSection = (typeof ATLAS_SECTIONS)[number];

export const SECTION_LABELS: Record<AtlasSection, string> = {
  mission: "Mission Control",
  reality: "Reality Engine",
  studio: "Architecture Studio",
  experiments: "Experiments",
  validation: "Validation Room",
  exchange: "Evidence Exchange",
  benchmarks: "Benchmarks",
  sources: "Sources",
  decisions: "Decisions",
  settings: "Settings",
  system: "Design System",
  agents: "Workflow Studio",
};

export function parseAtlasHash(hash: string): AtlasSection {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] !== "atlas") return "mission";
  const section = parts[1] as AtlasSection;
  return ATLAS_SECTIONS.includes(section) ? section : "mission";
}

export function atlasHash(section: AtlasSection): string {
  return `#/atlas/${section}`;
}

export function useAtlasSection(): [AtlasSection, (s: AtlasSection) => void] {
  const [section, setSection] = useState<AtlasSection>(() => parseAtlasHash(window.location.hash));
  useEffect(() => {
    const onHashChange = () => setSection(parseAtlasHash(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  const navigate = (s: AtlasSection) => {
    window.location.hash = atlasHash(s);
    setSection(s);
  };
  return [section, navigate];
}
