/**
 * Campaign 05, Tasks 03/04 — Nonvisual representation engine.
 *
 * Pure, DOM-free functions that turn lab state into structured text a screen
 * reader (or the nonvisual summary UI) can read meaningfully. A visual canvas
 * is not an accessible representation; these summaries are derived from the
 * canonical model so they can never drift from what the diagram shows.
 */

import type { ArchitectureModel, Finding } from "../model";

const KIND_WORDS: Record<string, string> = {
  client: "client", gateway: "gateway", service: "service", worker: "worker",
  queue: "queue", cache: "cache", database: "database", objectstore: "object store",
  broker: "broker", analytics: "analytics", external: "external system",
};
const CONN_WORDS: Record<string, string> = { sync: "synchronous", async: "asynchronous", event: "event" };

export interface TopologySummary {
  /** one-line overview, e.g. "10 components across 4 trust zones, 12 connections" */
  overview: string;
  /** per-trust-zone component listing */
  zones: { zone: string; components: { id: string; name: string; kind: string }[] }[];
  /** connection descriptions in stable order */
  connections: { from: string; to: string; kind: string; criticality: string }[];
}

export function topologySummary(model: ArchitectureModel): TopologySummary {
  const zoneOf = (zoneId?: string): string =>
    zoneId ? (model.zones.find((z) => z.id === zoneId)?.name ?? zoneId) : "unzoned";
  const zones = new Map<string, TopologySummary["zones"][number]>();
  for (const c of model.components) {
    const zone = zoneOf(c.zoneId);
    if (!zones.has(zone)) zones.set(zone, { zone, components: [] });
    zones.get(zone)!.components.push({ id: c.id, name: c.name, kind: KIND_WORDS[c.kind] ?? c.kind });
  }
  return {
    overview:
      `${model.components.length} components across ${zones.size} trust zones, ` +
      `${model.connections.length} connections`,
    zones: [...zones.values()].map((z) => ({
      zone: z.zone,
      components: [...z.components].sort((a, b) => a.id.localeCompare(b.id)),
    })).sort((a, b) => a.zone.localeCompare(b.zone)),
    connections: model.connections
      .map((c) => {
        const from = model.components.find((k) => k.id === c.from);
        const to = model.components.find((k) => k.id === c.to);
        return {
          from: from ? `${from.name} (${from.id})` : c.from,
          to: to ? `${to.name} (${to.id})` : c.to,
          kind: CONN_WORDS[c.kind] ?? c.kind,
          criticality: c.criticality >= 4 ? "high" : c.criticality >= 2 ? "medium" : "low",
        };
      })
      .sort((a, b) => `${a.from}->${a.to}`.localeCompare(`${b.from}->${b.to}`)),
  };
}

/** Render a topology summary as readable text lines (announcement-ready). */
export function topologySummaryText(s: TopologySummary): string[] {
  const lines = [`Architecture overview: ${s.overview}.`];
  for (const z of s.zones) {
    lines.push(`Trust zone ${z.zone}: ${z.components.map((c) => `${c.name} (${c.kind})`).join(", ")}.`);
  }
  for (const c of s.connections) {
    lines.push(`Connection: ${c.from} to ${c.to}, ${c.kind}, ${c.criticality} criticality.`);
  }
  return lines;
}

/**
 * Failure-propagation announcement: the causal chain as ordered text so a
 * nonvisual user gets the same information the red-path highlighting shows.
 */
export function propagationText(chain: Finding[], failedLabel: string): string[] {
  if (chain.length === 0) return [`No downstream effects modeled for ${failedLabel}.`];
  const lines = [`Failure of ${failedLabel} propagates through ${chain.length} modeled effects:`];
  chain.forEach((f, i) => {
    const sev = f.severity === "critical" ? "Critical" : f.severity === "warning" ? "Warning" : "Info";
    lines.push(`${i + 1}. ${sev}: ${f.title} — ${f.detail}`);
  });
  return lines;
}

/**
 * Comparison announcement: what actually differs between two architecture
 * descriptions, without requiring the side-by-side visual.
 */
export function comparisonText(
  labelA: string,
  labelB: string,
  diffs: { kind: string; description: string }[],
): string[] {
  if (diffs.length === 0) return [`${labelA} and ${labelB} are semantically equivalent.`];
  return [
    `${diffs.length} differences between ${labelA} and ${labelB}:`,
    ...diffs.map((d, i) => `${i + 1}. ${d.kind}: ${d.description}`),
  ];
}
