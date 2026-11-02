/**
 * Tiny hash-based router for the trail (no react-router dependency).
 * The host app uses a state-based view switcher; the trail keeps its own
 * shareable, refresh-safe URLs: #/trail, #/trail/topic/01, ...
 */
import { useEffect, useState } from "react";

export const STUDIO_TABS = [
  "scenarios", "design", "requirements", "validate", "capacity", "failures", "compare", "review", "decisions", "challenge", "export",
] as const;
export type StudioTab = (typeof STUDIO_TABS)[number];

export type TrailRoute =
  | { page: "studio"; tab: StudioTab }
  | { page: "landing" }
  | { page: "journey" }
  | { page: "topic"; id: number }
  | { page: "glossary" }
  | { page: "quiz" }
  | { page: "case-study" };

export function parseHash(hash: string): TrailRoute {
  const clean = hash.replace(/^#\/?/, "");
  const parts = clean.split("/").filter(Boolean);
  if (parts[0] === "studio") {
    const tab = STUDIO_TABS.find((t) => t === parts[1]);
    return { page: "studio", tab: tab ?? "scenarios" };
  }
  if (parts[0] !== "trail") return { page: "landing" };
  if (parts[1] === "topic" && parts[2]) {
    const id = parseInt(parts[2], 10);
    if (!Number.isNaN(id) && id >= 1 && id <= 20) return { page: "topic", id };
    return { page: "landing" };
  }
  if (parts[1] === "journey") return { page: "journey" };
  if (parts[1] === "glossary") return { page: "glossary" };
  if (parts[1] === "quiz") return { page: "quiz" };
  if (parts[1] === "case-study") return { page: "case-study" };
  return { page: "landing" };
}

export function routeToHash(r: TrailRoute): string {
  switch (r.page) {
    case "studio":
      return r.tab === "scenarios" ? "#/studio" : `#/studio/${r.tab}`;
    case "journey":
      return "#/trail/journey";
    case "topic":
      return `#/trail/topic/${String(r.id).padStart(2, "0")}`;
    case "glossary":
      return "#/trail/glossary";
    case "quiz":
      return "#/trail/quiz";
    case "case-study":
      return "#/trail/case-study";
    default:
      return "#/trail";
  }
}

export function useTrailRoute(): [TrailRoute, (r: TrailRoute) => void] {
  const [route, setRoute] = useState<TrailRoute>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  const navigate = (r: TrailRoute) => {
    window.location.hash = routeToHash(r);
    setRoute(r);
  };
  return [route, navigate];
}

export const topicHref = (id: number): string => `#/trail/topic/${String(id).padStart(2, "0")}`;
