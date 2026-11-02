/**
 * Exports: diagram (SVG), architecture specification (Markdown + JSON) and
 * challenge report (Markdown). Everything is built from the learner's actual
 * data and passed through redaction: no secrets, credentials or tokens leave.
 */
import { Architecture, ArchNode, CONN_LABELS, KIND_DEFS, Kind, Props } from "./model";
import { getTopic } from "../trail/content";
import { Scenario } from "./scenarios";
import { Adr, adrsToMarkdown } from "./adr";
import { Finding, SEVERITY_LABEL } from "./validation";
import { ReviewResult } from "./review";
import { evaluateRequirement } from "./requirements";
import { CONN_STYLE, CATEGORY_COLOR, NODE_H, NODE_W } from "./visual";
import { ChallengeSummary } from "./challenge";
import { FAILURES, getFailure } from "./failures";
import { CapacityInputs } from "./capacity";
import { RequirementMark } from "./store";

const SECRET_KEY = /secret|token|password|passwd|api[-_]?key|credential|private[-_]?key|authorization/i;
const SECRET_VALUE = /(sk|pk|rk)[-_][A-Za-z0-9]{12,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{12,}|xox[abp]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}|(password|passwd|secret|token|apikey|api_key)\s*[=:]\s*\S+/i;

export const REDACTED = "[redacted]";

export function redactText(s: string): string {
  return SECRET_VALUE.test(s) ? s.replace(new RegExp(SECRET_VALUE.source, "gi"), REDACTED) : s;
}

export function redactProps(p: Props): Props {
  const out: Props = {};
  for (const [k, v] of Object.entries(p)) out[k] = SECRET_KEY.test(k) ? REDACTED : typeof v === "string" ? redactText(v) : v;
  return out;
}

export function redactArchitecture(a: Architecture): Architecture {
  return {
    ...a,
    nodes: a.nodes.map((n) => ({ ...n, name: redactText(n.name), group: redactText(n.group), props: redactProps(n.props) })),
    connections: a.connections.map((c) => ({ ...c, label: redactText(c.label) })),
  };
}

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function clipToRect(n: ArchNode, tx: number, ty: number): { x: number; y: number } {
  const cx = n.x + NODE_W / 2;
  const cy = n.y + NODE_H / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const s = Math.min(NODE_W / 2 / Math.abs(dx || 1e-9), NODE_H / 2 / Math.abs(dy || 1e-9));
  return { x: cx + dx * s, y: cy + dy * s };
}

/** Self-contained SVG with title, legend, labels and groups. */
export function diagramSvg(a: Architecture, title: string, subtitle = ""): string {
  const R = redactArchitecture(a);
  const pad = 40;
  const top = 70;
  const maxX = Math.max(600, ...R.nodes.map((n) => n.x + NODE_W)) + pad;
  const maxY = Math.max(300, ...R.nodes.map((n) => n.y + NODE_H)) + pad;
  const legendH = 24 + Object.keys(CONN_STYLE).length * 20 + 24;
  const W = maxX;
  const H = maxY + top + legendH;
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d" font-family="system-ui, sans-serif">`);
  out.push(`<title id="t">${esc(title)}</title><desc id="d">${esc(subtitle || "Architecture diagram exported from TRACEN Architecture Studio")}</desc>`);
  out.push(`<defs>${(Object.keys(CONN_STYLE) as Array<keyof typeof CONN_STYLE>).map((k) => `<marker id="arrow-${k}" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0,0 L10,4 L0,8 z" fill="${CONN_STYLE[k].color}"/></marker>`).join("")}</defs>`);
  out.push(`<rect width="${W}" height="${H}" fill="#0f172a"/>`);
  out.push(`<text x="${pad}" y="32" fill="#f1f5f9" font-size="20" font-weight="700">${esc(title)}</text>`);
  if (subtitle) out.push(`<text x="${pad}" y="52" fill="#94a3b8" font-size="12">${esc(subtitle)}</text>`);
  out.push(`<g transform="translate(0,${top})">`);
  // groups
  const groups = new Map<string, ArchNode[]>();
  for (const n of R.nodes) if (n.group) groups.set(n.group, [...(groups.get(n.group) ?? []), n]);
  for (const [g, ns] of groups) {
    const x1 = Math.min(...ns.map((n) => n.x)) - 14, y1 = Math.min(...ns.map((n) => n.y)) - 26;
    const x2 = Math.max(...ns.map((n) => n.x + NODE_W)) + 14, y2 = Math.max(...ns.map((n) => n.y + NODE_H)) + 14;
    out.push(`<rect x="${x1}" y="${y1}" width="${x2 - x1}" height="${y2 - y1}" rx="12" fill="none" stroke="#64748b" stroke-dasharray="4 4"/><text x="${x1 + 10}" y="${y1 + 16}" fill="#94a3b8" font-size="11">${esc(g)}</text>`);
  }
  const byId = new Map(R.nodes.map((n) => [n.id, n]));
  // policy guard lines
  for (const n of R.nodes) {
    const t = KIND_DEFS[n.kind].policy ? byId.get(String(n.props.target)) : undefined;
    if (t) out.push(`<line x1="${n.x + NODE_W / 2}" y1="${n.y + NODE_H / 2}" x2="${t.x + NODE_W / 2}" y2="${t.y + NODE_H / 2}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="1 4"/>`);
  }
  for (const c of R.connections) {
    const f = byId.get(c.from), t = byId.get(c.to);
    if (!f || !t) continue;
    const s = CONN_STYLE[c.type];
    const p1 = clipToRect(f, t.x + NODE_W / 2, t.y + NODE_H / 2);
    const p2 = clipToRect(t, f.x + NODE_W / 2, f.y + NODE_H / 2);
    out.push(`<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${s.color}" stroke-width="2" ${s.dash ? `stroke-dasharray="${s.dash}"` : ""} marker-end="url(#arrow-${c.type})"><title>${esc(`${f.name} → ${t.name}: ${s.label}${c.label ? ` (${c.label})` : ""}`)}</title></line>`);
    if (c.label) out.push(`<text x="${(p1.x + p2.x) / 2}" y="${(p1.y + p2.y) / 2 - 5}" fill="#cbd5e1" font-size="10" text-anchor="middle">${esc(c.label)}</text>`);
  }
  for (const n of R.nodes) {
    const def = KIND_DEFS[n.kind];
    out.push(`<g><rect x="${n.x}" y="${n.y}" width="${NODE_W}" height="${NODE_H}" rx="8" fill="#1e293b" stroke="${CATEGORY_COLOR[def.category]}" stroke-width="2" ${def.policy ? 'stroke-dasharray="5 3"' : ""}/>`);
    out.push(`<text x="${n.x + 10}" y="${n.y + 24}" fill="#f1f5f9" font-size="13" font-weight="600">${esc(n.name.length > 22 ? `${n.name.slice(0, 21)}…` : n.name)}</text>`);
    out.push(`<text x="${n.x + 10}" y="${n.y + 42}" fill="#94a3b8" font-size="10">${esc(def.label)}${n.kind === "app_service" || n.kind === "worker" || n.kind === "web_app" ? ` ×${n.props.instances}` : ""}</text></g>`);
  }
  out.push("</g>");
  // legend
  const ly = top + maxY;
  out.push(`<text x="${pad}" y="${ly + 18}" fill="#f1f5f9" font-size="12" font-weight="700">Legend</text>`);
  (Object.keys(CONN_STYLE) as Array<keyof typeof CONN_STYLE>).forEach((k, i) => {
    const y = ly + 38 + i * 20;
    const s = CONN_STYLE[k];
    out.push(`<line x1="${pad}" y1="${y - 4}" x2="${pad + 50}" y2="${y - 4}" stroke="${s.color}" stroke-width="2" ${s.dash ? `stroke-dasharray="${s.dash}"` : ""} marker-end="url(#arrow-${k})"/><text x="${pad + 62}" y="${y}" fill="#cbd5e1" font-size="11">${esc(s.label)}</text>`);
  });
  out.push(`<line x1="${pad + 260}" y1="${ly + 34}" x2="${pad + 310}" y2="${ly + 34}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="1 4"/><text x="${pad + 322}" y="${ly + 38}" fill="#cbd5e1" font-size="11">Reliability policy guards its target</text>`);
  out.push("</svg>");
  return out.join("\n");
}

// -------------------------------------------------------------- specification

const topicName = (id: number): string => `Topic ${String(id).padStart(2, "0")} — ${getTopic(id)?.title ?? "?"}`;

export interface SpecInput {
  workspaceName: string;
  scenario: Scenario;
  arch: Architecture;
  adrs: Adr[];
  marks: Record<string, RequirementMark>;
  findings: Finding[];
  review: ReviewResult | null;
  capacity: CapacityInputs;
  exportedAt: string;
}

function propsTable(n: ArchNode): string {
  const rows = KIND_DEFS[n.kind].props.filter((p) => n.props[p.key] !== undefined && n.props[p.key] !== "" && p.key !== "justification").map((p) => {
    let v = String(redactProps(n.props)[p.key]);
    if (p.type === "target") v = (n.props[p.key] ? "(see target)" : "(none)");
    return `  - ${p.label}: ${v}`;
  });
  return rows.join("\n");
}

export function specificationMarkdown(i: SpecInput): string {
  const a = redactArchitecture(i.arch);
  const name = (id: string): string => a.nodes.find((n) => n.id === id)?.name ?? id;
  const reqs = i.scenario.requirements.map((r) => ({ r, e: evaluateRequirement(i.arch, r, { linkedAdrCount: i.adrs.filter((d) => d.relatedRequirementIds.includes(r.id)).length }) }));
  const L: string[] = [];
  L.push(`# Architecture specification — ${redactText(i.workspaceName)}`, "", `Scenario: **${i.scenario.name}** · Exported ${i.exportedAt}`, "");
  L.push("> Generated by TRACEN Architecture Studio. All traffic, capacity and failure figures are educational model outputs, not measurements or load-test results.", "");
  if (i.scenario.notice) L.push(`> ${i.scenario.notice}`, "");
  L.push("## Scenario", i.scenario.description, "");
  L.push("## Requirements", "| Requirement | Type | Structural evidence | Learner mark |", "|---|---|---|---|");
  for (const { r, e } of reqs) L.push(`| ${r.text} | ${r.type} | ${e.status} | ${i.marks[r.id] ? `${i.marks[r.id].status}${i.marks[r.id].note ? `: ${redactText(i.marks[r.id].note)}` : ""}` : "—"} |`);
  L.push("", "## Components");
  for (const n of a.nodes) L.push(`- **${n.name}** (${KIND_DEFS[n.kind].label})${n.group ? ` — group: ${n.group}` : ""}`, propsTable(n), ...(typeof n.props.justification === "string" && n.props.justification ? [`  - Justification: ${n.props.justification}`] : []));
  L.push("", "## Connections");
  for (const c of a.connections) L.push(`- ${name(c.from)} → ${name(c.to)} — ${CONN_LABELS[c.type]}${c.label ? ` (${c.label})` : ""}`);
  if (a.connections.length === 0) L.push("_None._");
  L.push("", "## Configuration — capacity assumptions", `Average ${i.capacity.avgRps} req/s, peak ${i.capacity.peakRps} req/s, ${i.capacity.instances} instance(s) × ${i.capacity.perInstanceRps} req/s (assumed), cache hit rate ${i.capacity.cacheHitRate}, job arrival ${i.capacity.jobArrivalRate}/s, ${i.capacity.workers} worker(s) × ${i.capacity.workerRatePerSec}/s.`);
  L.push("", "## Architecture decisions", adrsToMarkdown(i.adrs, { arch: a, requirements: i.scenario.requirements, topicTitle: (t) => getTopic(t)?.title ?? "?" }));
  L.push("", "## Known risks (validation findings)");
  if (i.findings.length === 0) L.push("_No findings._");
  for (const f of i.findings) L.push(`- **${SEVERITY_LABEL[f.severity]} — ${f.title}.** ${redactText(f.detected)} Why it matters: ${f.why} Topics: ${f.topics.map(topicName).join("; ") || "—"}.`);
  L.push("", "## Review summary");
  if (!i.review) L.push("_No review generated yet._");
  else for (const c of i.review.categories) L.push(`### ${c.label}`, `- Evidence: ${c.evidence.join(" ")}`, `- Missing: ${c.missing.join("; ") || "—"}`, `- Risks: ${c.risks.length ? c.risks.join("; ") : "—"}`, `- Next: ${c.next}`);
  return L.join("\n");
}

export function specificationJson(i: SpecInput): string {
  return JSON.stringify({
    format: "tracen-studio-specification", formatVersion: 1, exportedAt: i.exportedAt, name: redactText(i.workspaceName),
    scenario: { id: i.scenario.id, name: i.scenario.name },
    requirements: i.scenario.requirements.map((r) => ({ id: r.id, text: r.text, evidence: evaluateRequirement(i.arch, r, { linkedAdrCount: i.adrs.filter((d) => d.relatedRequirementIds.includes(r.id)).length }).status, mark: i.marks[r.id] ?? null })),
    architecture: redactArchitecture(i.arch),
    decisions: i.adrs.map((a) => ({ ...a, title: redactText(a.title), decision: redactText(a.decision), reason: redactText(a.reason), context: redactText(a.context) })),
    risks: i.findings.map((f) => ({ id: f.id, severity: f.severity, title: f.title, detected: redactText(f.detected), topics: f.topics })),
    review: i.review,
    capacityAssumptions: i.capacity,
    disclaimer: "Model outputs are educational; not measurements.",
  }, null, 2);
}

// -------------------------------------------------------------- challenge report

export interface ChallengeReportInput {
  workspaceName: string;
  scenario: Scenario;
  initial: Architecture | null;
  final: Architecture;
  adrs: Adr[];
  summary: ChallengeSummary;
  failuresRun: string[];
  exportedAt: string;
}

const archLines = (a: Architecture | null): string[] => {
  if (!a) return ["_No initial sketch was captured._"];
  const R = redactArchitecture(a);
  const nm = (id: string) => R.nodes.find((n) => n.id === id)?.name ?? id;
  return [`Components (${R.nodes.length}): ${R.nodes.map((n) => `${n.name} [${KIND_DEFS[n.kind as Kind].label}]`).join(", ") || "—"}`, `Connections (${R.connections.length}):`, ...R.connections.map((c) => `- ${nm(c.from)} → ${nm(c.to)} (${CONN_LABELS[c.type]})`)];
};

export function challengeReportMarkdown(i: ChallengeReportInput): string {
  const s = i.summary;
  const L: string[] = [`# Challenge report — ${redactText(i.workspaceName)}`, "", `Scenario: **${i.scenario.name}** · ${i.exportedAt}`, ""];
  L.push("## Initial architecture", ...archLines(i.initial), "", "## Final architecture", ...archLines(i.final), "");
  L.push("## Initial vs final", "| Measure | Initial | Final |", "|---|---|---|", ...s.initialVsFinal.map((r) => `| ${r.label} | ${r.initial} | ${r.final} |`), "");
  L.push("## Requirements addressed (structural evidence)", ...(s.requirementsAddressed.length ? s.requirementsAddressed.map((r) => `- ${r}`) : ["_None._"]), "");
  L.push("## Requirements unresolved", ...(s.requirementsUnresolved.length ? s.requirementsUnresolved.map((r) => `- ${r.text} — missing: ${r.missing.join("; ")}`) : ["_None._"]), "");
  const fl = (ids: string[]) => ids.map((id) => `- ${getFailure(id as never).name}`).join("\n") || "_None._";
  L.push("## Failure-injection results (model, final architecture)", `**Survived (handled or degraded):**\n${fl(s.failuresSurvived)}`, "", `**Not handled:**\n${fl(s.failuresNotHandled)}`, "", `**Not applicable (no matching component):**\n${fl(s.failuresNotApplicable)}`, "");
  L.push(`Failures the learner injected during the challenge: ${i.failuresRun.map((id) => FAILURES.find((f) => f.id === id)?.name ?? id).join(", ") || "none"}.`, "");
  L.push("## Architecture Decision Records", adrsToMarkdown(i.adrs, { arch: i.final, requirements: i.scenario.requirements, topicTitle: (t) => getTopic(t)?.title ?? "?" }), "");
  L.push("## Simplicity", `${s.simplicity.justified}/${s.simplicity.components} components are required by a scenario requirement, free policies, or carry a stated reason.${s.simplicity.unjustified.length ? ` Unjustified: ${s.simplicity.unjustified.join(", ")}.` : ""}`, "");
  L.push("## Topics practiced", s.topicsPracticed.map(topicName).join("; ") || "—", "", "## Areas for further study", s.furtherStudy.map(topicName).join("; ") || "—", "");
  L.push("## Known limitations", "- Evidence is structural (what the diagram contains), not proof the implementation works.", "- Failure outcomes come from a deterministic educational model, not fault injection against real systems.", "- Capacity figures use the learner’s assumptions and are not a load test.", `- Hints used: ${s.hintsUsed}.`);
  return L.join("\n");
}

export function safeFilename(name: string, ext: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "architecture";
  return `${base}.${ext}`;
}
