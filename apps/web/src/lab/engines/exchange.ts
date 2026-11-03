/**
 * Campaign 05, Tasks 26/28/29/30/31/32/33/40 — Evidence exchange:
 * inbox/outbox lifecycle, reviewer annotations, review-response packages,
 * semantic package diff, conflict-aware reconciliation, the cross-user
 * provenance chain, and retention/deletion — all pure state machines over
 * an injectable store, no backend required.
 */

import type { ArchitectureModel } from "../model";
import { parseModel, diffModels } from "../model";
import type { DepPackage } from "./dep";
import { depDigest } from "./dep";

// ---------------------------------------------------------------------------
// Task 28 — inbox / outbox lifecycle
// ---------------------------------------------------------------------------

export type ExchangeStatus =
  | "drafted" | "exported" | "received" | "inspected"
  | "accepted" | "rejected" | "reviewed" | "replied";

export interface ExchangeAction {
  at: string;
  action: "draft" | "export" | "receive" | "inspect" | "accept" | "reject" | "review" | "reply" | "delete";
  detail: string;
}

export interface ExchangeItem {
  id: string;
  direction: "outbox" | "inbox";
  status: ExchangeStatus;
  digest: string;
  packageId: string;
  /** package version this item tracks (packages are immutable; versions chain) */
  version: number;
  actions: ExchangeAction[];
  /** the immutable package payload this item wraps */
  package_: DepPackage | null;
  /** annotations attached by the local reviewer (never mutate the package) */
  annotations: Annotation[];
}

export interface ExchangeState {
  items: ExchangeItem[];
  identityName: string;
}

export const emptyExchangeState = (identityName = "anonymous"): ExchangeState => ({
  items: [],
  identityName,
});

/** The legal status transitions — anything else is an invalid sequence. */
const TRANSITIONS: Record<ExchangeStatus, ExchangeStatus[]> = {
  drafted: ["exported"],
  exported: ["replied"],
  received: ["inspected", "rejected"],
  inspected: ["accepted", "rejected", "reviewed"],
  accepted: [],
  rejected: [],
  reviewed: ["replied"],
  replied: [],
};

export class ExchangeError extends Error {}

function transition(state: ExchangeState, itemId: string, to: ExchangeStatus, action: ExchangeAction): ExchangeState {
  const item = state.items.find((i) => i.id === itemId);
  if (!item) throw new ExchangeError(`no exchange item ${itemId}`);
  if (!TRANSITIONS[item.status].includes(to)) {
    throw new ExchangeError(`invalid transition ${item.status} -> ${to}`);
  }
  return {
    ...state,
    items: state.items.map((i) =>
      i.id === itemId ? { ...i, status: to, actions: [...i.actions, action] } : i,
    ),
  };
}

export const draftPackage = (state: ExchangeState, pkg: DepPackage, at: string): ExchangeState => ({
  ...state,
  items: [...state.items, {
    id: `out-${pkg.packageId}`,
    direction: "outbox" as const,
    status: "drafted" as const,
    digest: depDigest(pkg),
    packageId: pkg.packageId,
    version: 1,
    actions: [{ at, action: "draft", detail: `drafted package ${pkg.packageId}` }],
    package_: pkg,
    annotations: [],
  }],
});

export const markExported = (state: ExchangeState, packageId: string, at: string): ExchangeState =>
  transition(state, `out-${packageId}`, "exported", { at, action: "export", detail: `exported package ${packageId}` });

/** Receiving is staged: the item starts at `received`; nothing is applied yet. */
export const receivePackage = (state: ExchangeState, pkg: DepPackage, at: string): ExchangeState => {
  if (state.items.some((i) => i.packageId === pkg.packageId && i.direction === "inbox")) {
    throw new ExchangeError(`package ${pkg.packageId} already received`);
  }
  return {
    ...state,
    items: [...state.items, {
      id: `in-${pkg.packageId}`,
      direction: "inbox" as const,
      status: "received" as const,
      digest: depDigest(pkg),
      packageId: pkg.packageId,
      version: 1,
      actions: [{ at, action: "receive", detail: `received package ${pkg.packageId} from ${pkg.createdBy.name}` }],
      package_: pkg,
      annotations: [],
    }],
  };
};

export const inspectPackage = (state: ExchangeState, packageId: string, at: string): ExchangeState =>
  transition(state, `in-${packageId}`, "inspected", { at, action: "inspect", detail: "recipient inspected the import preview" });

export const acceptPackage = (state: ExchangeState, packageId: string, at: string): ExchangeState =>
  transition(state, `in-${packageId}`, "accepted", { at, action: "accept", detail: "recipient approved staged adoption" });

export const rejectPackage = (state: ExchangeState, packageId: string, at: string): ExchangeState =>
  transition(state, `in-${packageId}`, "rejected", { at, action: "reject", detail: "recipient rejected the package" });

// ---------------------------------------------------------------------------
// Task 29 — reviewer annotations (evidence-linked comments)
// ---------------------------------------------------------------------------

export type AnnotationTarget =
  | `component:${string}` | `connection:${string}` | `requirement:${string}`
  | `evidence:${string}` | `scenario:${string}` | `criterion:${string}`;

export interface Annotation {
  id: string;
  target: AnnotationTarget;
  comment: string;
  author: string;
  createdAt: string;
  status: "open" | "resolved" | "reopened";
  responses: { at: string; author: string; text: string }[];
}

export const addAnnotation = (
  state: ExchangeState,
  packageId: string,
  a: Omit<Annotation, "id" | "status" | "responses">,
): ExchangeState => {
  if (!/^(component|connection|requirement|evidence|scenario|criterion):[\w.-]+$/.test(a.target)) {
    throw new ExchangeError(`invalid annotation target ${a.target}`);
  }
  if (a.comment.trim().length < 3) throw new ExchangeError("annotation comment too short");
  const annId = `ann-${packageId}-${a.target.replace(/[^a-z0-9.-]/gi, "-")}-${(state.items.find((i) => i.packageId === packageId)?.annotations.length ?? 0) + 1}`;
  return {
    ...state,
    items: state.items.map((i) =>
      i.packageId === packageId
        ? { ...i, annotations: [...i.annotations, { ...a, id: annId, status: "open" as const, responses: [] }] }
        : i,
    ),
  };
};

export const resolveAnnotation = (state: ExchangeState, annotationId: string, at: string, author: string, note: string): ExchangeState => ({
  ...state,
  items: state.items.map((i) => ({
    ...i,
    annotations: i.annotations.map((a) =>
      a.id === annotationId
        ? { ...a, status: "resolved" as const, responses: [...a.responses, { at, author, text: note }] }
        : a,
    ),
  })),
});

export const reopenAnnotation = (state: ExchangeState, annotationId: string, at: string, author: string, note: string): ExchangeState => ({
  ...state,
  items: state.items.map((i) => ({
    ...i,
    annotations: i.annotations.map((a) =>
      a.id === annotationId
        ? { ...a, status: "reopened" as const, responses: [...a.responses, { at, author, text: note }] }
        : a,
    ),
  })),
});

/** Annotations whose target no longer resolves inside the package (integrity). */
export function danglingAnnotations(item: ExchangeItem): Annotation[] {
  const pkg = item.package_;
  if (!pkg) return item.annotations; // nothing to resolve against → all dangling
  let model: ArchitectureModel | null = null;
  try {
    model = parseModel(pkg.modelJson);
  } catch {
    model = null;
  }
  return item.annotations.filter((a) => {
    const [kind, id] = a.target.split(":");
    switch (kind) {
      case "component": return !model || !model.components.some((c) => c.id === id);
      case "connection": return !model || !model.connections.some((c) => c.id === id);
      case "requirement": return !model || !model.requirements.some((r) => r.id === id);
      case "evidence": return !pkg.evidence.some((e) => e.id === id);
      case "scenario": return !pkg.scenario || pkg.scenario.id !== id;
      case "criterion": return true; // criteria live in benchmark runs, not packages: flagged for manual check
      default: return true;
    }
  });
}

// ---------------------------------------------------------------------------
// Task 30 — review-response packages
// ---------------------------------------------------------------------------

export interface ReviewResponsePackage {
  format: "datanova-review-response";
  schemaVersion: 1;
  responseId: string;
  /** the exact source package being reviewed */
  responseTo: { packageId: string; digest: string; schemaVersion: number };
  reviewer: { name: string; identity: "self-declared" | "anonymous" };
  createdAt: string;
  verdict: "approve" | "request-changes" | "reject";
  annotations: Annotation[];
  disputedClaims: { claimId: string; reason: string }[];
  corrections: { target: string; suggestion: string }[];
  evidenceRefs: string[];
}

export const buildReviewResponse = (
  responseTo: DepPackage,
  reviewer: { name: string; identity: "self-declared" | "anonymous" },
  annotations: Annotation[],
  verdict: ReviewResponsePackage["verdict"],
  disputedClaims: { claimId: string; reason: string }[],
  corrections: { target: string; suggestion: string }[],
  createdAt: string,
): ReviewResponsePackage => ({
  format: "datanova-review-response",
  schemaVersion: 1,
  responseId: `resp-${depDigest(responseTo).slice(0, 12)}-${createdAt.replace(/[^0-9]/g, "").slice(-6)}`,
  responseTo: { packageId: responseTo.packageId, digest: depDigest(responseTo), schemaVersion: responseTo.schemaVersion },
  reviewer,
  createdAt,
  verdict,
  annotations,
  disputedClaims: disputedClaims.filter((d) => d.claimId && d.reason.length > 3),
  corrections,
  evidenceRefs: [...new Set(annotations.flatMap((a) => (a.target.startsWith("evidence:") ? [a.target.split(":")[1]] : [])))],
});

export interface ResponseImportVerdict {
  valid: boolean;
  response: ReviewResponsePackage | null;
  problems: string[];
}

/** A response is only valid against the exact package it reviews (digest-bound). */
export function validateReviewResponse(text: string, original: DepPackage): ResponseImportVerdict {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { valid: false, response: null, problems: [`malformed JSON: ${(e as Error).message}`] };
  }
  const r = raw as ReviewResponsePackage;
  const problems: string[] = [];
  if (!r || r.format !== "datanova-review-response") problems.push("not a review response package");
  if (r.schemaVersion !== 1) problems.push(`unsupported response schemaVersion ${r.schemaVersion}`);
  if (!r.responseId) problems.push("missing responseId");
  if (r.responseTo?.packageId !== original.packageId) problems.push(`response targets package ${r.responseTo?.packageId}, not ${original.packageId}`);
  if (r.responseTo?.digest !== depDigest(original)) problems.push("response digest does not match the current package version — the package changed after review");
  if (!["approve", "request-changes", "reject"].includes(r.verdict)) problems.push("invalid verdict");
  if (!Array.isArray(r.annotations)) problems.push("annotations must be an array");
  if (!r.reviewer?.name) problems.push("missing reviewer name");
  if (problems.length > 0) return { valid: false, response: null, problems };
  return { valid: true, response: r, problems: [] };
}

/** Author's view of a response: which findings are new/resolved/disputed/open. */
export function responseSummary(response: ReviewResponsePackage): {
  totalAnnotations: number;
  open: number;
  resolved: number;
  disputedClaims: string[];
  corrections: number;
  verdict: string;
} {
  return {
    totalAnnotations: response.annotations.length,
    open: response.annotations.filter((a) => a.status !== "resolved").length,
    resolved: response.annotations.filter((a) => a.status === "resolved").length,
    disputedClaims: response.disputedClaims.map((d) => d.claimId),
    corrections: response.corrections.length,
    verdict: response.verdict,
  };
}

// ---------------------------------------------------------------------------
// Task 31 — semantic package diff
// ---------------------------------------------------------------------------

export type DiffCategory = "topology" | "properties" | "assumptions" | "evidence" | "results" | "metadata";

export interface PackageDiffEntry {
  category: DiffCategory;
  change: "added" | "removed" | "changed" | "uncomparable";
  target: string;
  description: string;
}

/** Diff two packages semantically (stable ids; never fooled by reordering). */
export function diffPackages(a: DepPackage, b: DepPackage): PackageDiffEntry[] {
  const out: PackageDiffEntry[] = [];
  let modelA: ArchitectureModel | null = null;
  let modelB: ArchitectureModel | null = null;
  try {
    modelA = parseModel(a.modelJson);
    modelB = parseModel(b.modelJson);
  } catch {
    out.push({ category: "topology", change: "uncomparable", target: "modelJson", description: "one model no longer validates — semantic comparison impossible" });
  }
  if (modelA && modelB) {
    for (const ch of diffModels(modelA, modelB)) {
      out.push({
        category: ch.classification === "structural" ? "topology" : "properties",
        change: ch.type === "modified" ? "changed" : (ch.type as "added" | "removed"),
        target: `${ch.target}:${ch.id}`,
        description: `${ch.type}: ${ch.detail} (${ch.classification})`,
      });
    }
  }
  const assumptionsA = new Map(a.assumptions.map((x) => [x.ref, x.statement]));
  for (const { ref, statement } of b.assumptions) {
    if (!assumptionsA.has(ref)) out.push({ category: "assumptions", change: "added", target: ref, description: `assumption added: ${statement}` });
    else if (assumptionsA.get(ref) !== statement) out.push({ category: "assumptions", change: "changed", target: ref, description: `assumption changed: "${assumptionsA.get(ref)}" -> "${statement}"` });
  }
  for (const [ref] of assumptionsA) {
    if (!b.assumptions.some((x) => x.ref === ref)) out.push({ category: "assumptions", change: "removed", target: ref, description: `assumption removed: ${ref}` });
  }
  const evA = new Set(a.evidence.map((e) => e.id));
  const evB = new Set(b.evidence.map((e) => e.id));
  for (const id of evB) if (!evA.has(id)) out.push({ category: "evidence", change: "added", target: `evidence:${id}`, description: `evidence artifact added: ${id}` });
  for (const id of evA) if (!evB.has(id)) out.push({ category: "evidence", change: "removed", target: `evidence:${id}`, description: `evidence artifact removed: ${id}` });
  const resA = new Map(a.results.map((r) => [r.expectationId, r.outcome]));
  for (const r of b.results) {
    if (!resA.has(r.expectationId)) out.push({ category: "results", change: "added", target: r.expectationId, description: `expectation result added: ${r.outcome}` });
    else if (resA.get(r.expectationId) !== r.outcome) {
      out.push({ category: "results", change: "changed", target: r.expectationId, description: `expectation outcome changed: ${resA.get(r.expectationId)} -> ${r.outcome}` });
    }
  }
  if (a.createdBy.name !== b.createdBy.name) {
    out.push({ category: "metadata", change: "changed", target: "createdBy", description: `author changed: ${a.createdBy.name} -> ${b.createdBy.name}` });
  }
  return out.sort((x, y) => x.target.localeCompare(y.target) || x.category.localeCompare(y.category));
}

// ---------------------------------------------------------------------------
// Task 32 — conflict-aware reconciliation
// ---------------------------------------------------------------------------

export interface ReconciliationConflict {
  target: string;
  localChange: string;
  incomingChange: string;
  consequence: string;
  options: ("safe-merge" | "preserve-local" | "accept-incoming" | "reject")[];
}

/**
 * Reconcile an incoming review response against the AUTHOR's current work.
 * The response was recorded against an older package version; anything the
 * author changed since is a conflict the user must decide — never silently
 * overwritten.
 */
export function reconcileResponse(
  original: DepPackage,
  current: DepPackage,
  response: ReviewResponsePackage,
): { conflicts: ReconciliationConflict[]; safe: boolean; basis: string } {
  const conflicts: ReconciliationConflict[] = [];
  const changedSinceReview = diffPackages(original, current);
  const changedTargets = new Set(changedSinceReview.map((d) => d.target.split(":")[d.target.split(":").length - 1]));
  for (const ann of response.annotations) {
    const targetId = ann.target.split(":")[1];
    if (changedTargets.has(targetId)) {
      conflicts.push({
        target: ann.target,
        localChange: `the element changed locally since the reviewed version (${changedSinceReview.filter((d) => d.target.includes(targetId)).map((d) => d.description).join("; ")})`,
        incomingChange: `reviewer annotation: ${ann.comment}`,
        consequence: "applying the annotation blindly could mask newer local work",
        options: ["preserve-local", "accept-incoming", "reject"],
      });
    }
  }
  for (const c of response.corrections) {
    const targetId = c.target.split(":")[1];
    if (changedTargets.has(targetId)) {
      conflicts.push({
        target: c.target,
        localChange: `the element changed locally since the reviewed version`,
        incomingChange: `suggested correction: ${c.suggestion}`,
        consequence: "the suggestion was written against an older element state",
        options: ["preserve-local", "accept-incoming", "reject"],
      });
    }
  }
  return {
    conflicts,
    safe: conflicts.length === 0,
    basis: `response bound to package ${response.responseTo.packageId} digest ${response.responseTo.digest.slice(0, 8)}; local version differs in ${changedSinceReview.length} place(s)`,
  };
}

// ---------------------------------------------------------------------------
// Task 33 — provenance chain across users
// ---------------------------------------------------------------------------

export type ProvenanceEventType =
  | "authored" | "exported" | "imported" | "reviewed" | "responded" | "corrected" | "accepted";

export interface ProvenanceEvent {
  id: string;
  type: ProvenanceEventType;
  at: string;
  actor: string;
  packageId: string;
  /** digest of the package version this event refers to */
  digest: string;
  /** id of the previous event in the chain (null for the first) */
  prev: string | null;
  note: string;
}

export interface ProvenanceChainProblem {
  eventId: string;
  problem: string;
}

/** Append an event, preserving all previous events immutably. */
export function appendProvenanceEvent(chain: ProvenanceEvent[], e: Omit<ProvenanceEvent, "id" | "prev">): ProvenanceEvent[] {
  const prev = chain.length > 0 ? chain[chain.length - 1].id : null;
  const id = `prov-${chain.length + 1}`;
  return [...chain, { ...e, id, prev }];
}

/** Verify a chain: no broken links, digests reference known packages, order is total. */
export function verifyProvenanceChain(
  chain: ProvenanceEvent[],
  knownPackages: { packageId: string; digest: string }[],
): ProvenanceChainProblem[] {
  const problems: ProvenanceChainProblem[] = [];
  const byId = new Map(chain.map((e) => [e.id, e]));
  const known = new Set(knownPackages.map((p) => `${p.packageId}@${p.digest}`));
  chain.forEach((e, i) => {
    if (!e.id || !e.at || !e.actor) problems.push({ eventId: e.id, problem: "incomplete event" });
    if (e.prev && !byId.has(e.prev)) problems.push({ eventId: e.id, problem: `broken prev link ${e.prev}` });
    if (i > 0 && e.prev !== chain[i - 1].id) problems.push({ eventId: e.id, problem: "chain is not in linked order" });
    if (!known.has(`${e.packageId}@${e.digest}`)) {
      problems.push({ eventId: e.id, problem: `references unknown package version ${e.packageId}@${e.digest}` });
    }
  });
  return problems;
}

/** Inspectable timeline text (graph form is the chain itself). */
export function provenanceTimeline(chain: ProvenanceEvent[]): string[] {
  return chain.map((e) =>
    `${e.at} — ${e.actor} ${e.type} package ${e.packageId} (digest ${e.digest.slice(0, 8)})${e.note ? ` — ${e.note}` : ""}`,
  );
}

// ---------------------------------------------------------------------------
// Task 40 — retention and deletion
// ---------------------------------------------------------------------------

/**
 * Delete a received package and its LOCAL review data (annotations). Exported
 * history items in the outbox are preserved for the author's own attribution
 * record unless the user also opts to remove them. Returns the new state and
 * what was deleted — so the UI can show an honest "removed" receipt.
 */
export function deleteExchangeData(
  state: ExchangeState,
  packageId: string,
  opts: { alsoOutboxHistory?: boolean } = {},
): { state: ExchangeState; removed: { packageId: string; annotations: number; actions: number } | null } {
  const item = state.items.find((i) => i.packageId === packageId);
  if (!item) return { state, removed: null };
  const keep = item.direction === "outbox" && !opts.alsoOutboxHistory;
  if (keep) {
    // outbox item stays as attribution history, but local annotations are removed
    return {
      state: {
        ...state,
        items: state.items.map((i) => (i.packageId === packageId ? { ...i, annotations: [] } : i)),
      },
      removed: { packageId, annotations: item.annotations.length, actions: 0 },
    };
  }
  return {
    state: { ...state, items: state.items.filter((i) => i.packageId !== packageId) },
    removed: { packageId, annotations: item.annotations.length, actions: item.actions.length },
  };
}
