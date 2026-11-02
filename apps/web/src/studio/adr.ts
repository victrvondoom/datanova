/** Architecture Decision Records: create / edit / delete / link / export. Pure. */
import { Architecture } from "./model";
import { Requirement } from "./requirements";

export type AdrStatus = "Proposed" | "Accepted" | "Superseded";
export const ADR_STATUSES: AdrStatus[] = ["Proposed", "Accepted", "Superseded"];

export interface Adr {
  id: string;
  number: number;
  title: string;
  status: AdrStatus;
  context: string;
  /** the selected option — what we are choosing */
  decision: string;
  alternatives: string;
  /** why the selected option */
  reason: string;
  tradeoffs: string;
  risks: string;
  followUp: string;
  relatedRequirementIds: string[];
  relatedTopicIds: number[];
  relatedNodeIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type AdrDraft = Omit<Adr, "id" | "number" | "createdAt" | "updatedAt">;

export const emptyDraft = (): AdrDraft => ({
  title: "", status: "Proposed", context: "", decision: "", alternatives: "", reason: "", tradeoffs: "", risks: "", followUp: "",
  relatedRequirementIds: [], relatedTopicIds: [], relatedNodeIds: [],
});

export const adrId = (n: number): string => `ADR-${String(n).padStart(3, "0")}`;

export function validateDraft(d: AdrDraft): string[] {
  const errs: string[] = [];
  if (d.title.trim().length < 3) errs.push("Give the decision a short title.");
  if (d.decision.trim().length < 5) errs.push("State what you are choosing.");
  if (d.reason.trim().length < 5) errs.push("Say why — the reason is the point of an ADR.");
  return errs;
}

const clip = (s: string, n = 4000): string => String(s ?? "").slice(0, n);

export function createAdr(adrs: Adr[], draft: AdrDraft, now: string): { adrs: Adr[]; adr: Adr } | { error: string[] } {
  const errs = validateDraft(draft);
  if (errs.length) return { error: errs };
  const number = adrs.reduce((m, a) => Math.max(m, a.number), 0) + 1;
  const adr: Adr = { ...normalizeDraft(draft), id: adrId(number), number, createdAt: now, updatedAt: now };
  return { adrs: [...adrs, adr], adr };
}

export function normalizeDraft(d: AdrDraft): AdrDraft {
  return {
    title: clip(d.title, 120), status: ADR_STATUSES.includes(d.status) ? d.status : "Proposed",
    context: clip(d.context), decision: clip(d.decision), alternatives: clip(d.alternatives), reason: clip(d.reason),
    tradeoffs: clip(d.tradeoffs), risks: clip(d.risks), followUp: clip(d.followUp),
    relatedRequirementIds: [...new Set(d.relatedRequirementIds.map(String))].slice(0, 50),
    relatedTopicIds: [...new Set(d.relatedTopicIds.filter((t) => Number.isInteger(t) && t >= 1 && t <= 20))],
    relatedNodeIds: [...new Set(d.relatedNodeIds.map(String))].slice(0, 100),
  };
}

export function updateAdr(adrs: Adr[], id: string, patch: Partial<AdrDraft>, now: string): { adrs: Adr[] } | { error: string[] } {
  const cur = adrs.find((a) => a.id === id);
  if (!cur) return { error: ["ADR not found."] };
  const merged = normalizeDraft({ ...cur, ...patch });
  const errs = validateDraft(merged);
  if (errs.length) return { error: errs };
  return { adrs: adrs.map((a) => (a.id === id ? { ...a, ...merged, updatedAt: now } : a)) };
}

export const deleteAdr = (adrs: Adr[], id: string): Adr[] => adrs.filter((a) => a.id !== id);

/** Remove links to nodes that no longer exist (call after deleting a component). */
export const pruneNodeLinks = (adrs: Adr[], arch: Architecture): Adr[] => {
  const ids = new Set(arch.nodes.map((n) => n.id));
  return adrs.map((a) => ({ ...a, relatedNodeIds: a.relatedNodeIds.filter((i) => ids.has(i)) }));
};

export interface AdrExportContext {
  arch: Architecture;
  requirements: Requirement[];
  topicTitle: (id: number) => string;
}

export function adrToMarkdown(a: Adr, ctx: AdrExportContext): string {
  const reqs = a.relatedRequirementIds.map((id) => ctx.requirements.find((r) => r.id === id)).filter((r): r is Requirement => !!r);
  const nodes = a.relatedNodeIds.map((id) => ctx.arch.nodes.find((n) => n.id === id)).filter((n) => !!n);
  const consequences = [a.reason && `**Why:** ${a.reason}`, a.tradeoffs && `**Trade-offs:** ${a.tradeoffs}`, a.risks && `**Risks:** ${a.risks}`, a.followUp && `**Follow-up:** ${a.followUp}`].filter(Boolean).join("\n\n");
  return [
    `# ${a.id} — ${a.title}`,
    `## Status\n${a.status}`,
    `## Context\n${a.context || "_Not provided._"}`,
    `## Decision\n${a.decision}`,
    `## Alternatives\n${a.alternatives || "_Not provided._"}`,
    `## Consequences\n${consequences || "_Not provided._"}`,
    `## Related Requirements\n${reqs.length ? reqs.map((r) => `- ${r.text}`).join("\n") : "_None linked._"}`,
    `## Related Topics\n${a.relatedTopicIds.length ? a.relatedTopicIds.map((t) => `- Topic ${String(t).padStart(2, "0")} — ${ctx.topicTitle(t)}`).join("\n") : "_None linked._"}`,
    `## Related Components\n${nodes.length ? nodes.map((n) => `- ${n?.name}`).join("\n") : "_None linked._"}`,
  ].join("\n\n");
}

export const adrsToMarkdown = (adrs: Adr[], ctx: AdrExportContext): string =>
  adrs.length ? adrs.map((a) => adrToMarkdown(a, ctx)).join("\n\n---\n\n") : "_No decisions recorded._";
