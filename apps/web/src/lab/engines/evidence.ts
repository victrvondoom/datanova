/**
 * Campaign 04, Task 05 — Evidence and Provenance Infrastructure.
 *
 * Every important conclusion gets a typed evidence artifact: where it came
 * from (source engine/rule/test), when it was produced (caller-supplied
 * timestamp — engines stay pure), which model version and scenario produced
 * it, which assumptions it depends on, and what KIND of evidence it is:
 * observed | simulated | inferred | user-authored. Integrity checks reject
 * artifacts whose references dangle, and evidence packs export deterministically.
 */

import type { ArchitectureModel, Finding } from "../model";
import { MODEL_VERSION } from "../model";
import type { Recording } from "./flightrecorder";

export type EvidenceKind = "observed" | "simulated" | "inferred" | "user-authored";

export interface EvidenceArtifact {
  id: string;
  kind: EvidenceKind;
  /** engine, rule, test, or human author that produced this */
  source: string;
  /** one-line conclusion the artifact supports */
  summary: string;
  /** ISO timestamp supplied by the caller (pure engine: no Date() here) */
  createdAt: string;
  modelVersion: number;
  /** canonical-model fingerprint the artifact was produced against */
  archFingerprint?: string;
  /** scenario/experiment id, when produced inside one */
  scenarioRef?: string;
  /** assumption ids/statements the conclusion depends on */
  assumptions: { ref: string; statement: string }[];
  /** entity references supporting the claim (component:…, requirement:…) */
  refs: string[];
  /** deterministic seeds / commands that reproduce it, when applicable */
  reproduction?: { seed?: number; command: string };
}

export interface EvidencePack {
  schemaVersion: number;
  packId: string;
  createdAt: string;
  modelVersion: number;
  artifacts: EvidenceArtifact[];
}

export const EVIDENCE_PACK_VERSION = 1;

let counter = 0;
function evidenceId(): string {
  counter += 1;
  return `ev-${counter.toString(36)}`;
}

/** Which engine families produce which kind of evidence (documented mapping). */
const SOURCE_KINDS: { prefix: string; kind: EvidenceKind }[] = [
  { prefix: "causal", kind: "simulated" },
  { prefix: "blast", kind: "simulated" },
  { prefix: "consistency", kind: "simulated" },
  { prefix: "recovery", kind: "simulated" },
  { prefix: "chaos", kind: "simulated" },
  { prefix: "resource", kind: "simulated" },
  { prefix: "drift", kind: "inferred" },
  { prefix: "critic", kind: "inferred" },
  { prefix: "trust", kind: "inferred" },
  { prefix: "tenant", kind: "inferred" },
  { prefix: "authz", kind: "inferred" },
  { prefix: "lineage", kind: "inferred" },
  { prefix: "adversarial", kind: "inferred" },
  { prefix: "intent", kind: "inferred" },
  { prefix: "constraints", kind: "inferred" },
  { prefix: "obs", kind: "inferred" },
];

/** UI helper: what kind of evidence does a finding's source engine produce? */
export function kindOfSource(source: string): EvidenceKind {
  const hit = SOURCE_KINDS.find((s) => source.startsWith(s.prefix));
  return hit?.kind ?? "inferred";
}

/** Capture a finding as an evidence artifact (kind derived from its source). */
export function captureFinding(
  f: Finding,
  meta: { createdAt: string; scenarioRef?: string; archFingerprint?: string },
  opts: { kindOverride?: EvidenceKind; assumptions?: { ref: string; statement: string }[] } = {},
): EvidenceArtifact {
  const derived = SOURCE_KINDS.find((s) => f.source.startsWith(s.prefix));
  const kind = opts.kindOverride ?? derived?.kind ?? "inferred";
  return {
    id: evidenceId(),
    kind,
    source: `engine:${f.source}/${f.id}`,
    summary: f.title,
    createdAt: meta.createdAt,
    modelVersion: MODEL_VERSION,
    archFingerprint: meta.archFingerprint,
    scenarioRef: meta.scenarioRef,
    assumptions: opts.assumptions ?? [],
    refs: f.evidence.map((e) => e.ref).filter((r) => !r.startsWith("trade-off") && !r.startsWith("recording:") && !r.startsWith("test:")),
  };
}

/** Capture a flight-recorder run: its events are simulated evidence. */
export function captureRecording(
  rec: Recording,
  meta: { createdAt: string; archFingerprint?: string; seed?: number },
): EvidenceArtifact {
  return {
    id: evidenceId(),
    kind: "simulated",
    source: "engine:flight-recorder",
    summary: `${rec.events.length} recorded events for experiment ${rec.experimentId}`,
    createdAt: meta.createdAt,
    modelVersion: MODEL_VERSION,
    archFingerprint: meta.archFingerprint,
    scenarioRef: rec.experimentId,
    assumptions: [{ ref: "assumption:deterministic-fold", statement: "replay is a pure fold over the append-only event log" }],
    refs: [...new Set(rec.events.filter((e) => e.componentId).map((e) => `component:${e.componentId}`))],
    reproduction: { seed: meta.seed, command: "replay: fold events with stateAt(recording, seq)" },
  };
}

/** User-authored evidence: a decision, assumption, or note written by a human. */
export function userEvidence(
  summary: string,
  refs: string[],
  meta: { createdAt: string; author: string; archFingerprint?: string },
): EvidenceArtifact {
  return {
    id: evidenceId(),
    kind: "user-authored",
    source: `user:${meta.author}`,
    summary,
    createdAt: meta.createdAt,
    modelVersion: MODEL_VERSION,
    archFingerprint: meta.archFingerprint,
    assumptions: [],
    refs,
  };
}

// ---------------------------------------------------------------------------
// Integrity
// ---------------------------------------------------------------------------

export interface EvidenceIntegrityIssue {
  artifactId: string;
  problem: string;
}

/**
 * Integrity: every entity reference in every artifact must resolve in the
 * model (or be explicitly non-entity, like assumption:/rule: references);
 * artifacts without a source or summary are rejected; kinds must be known.
 */
export function checkEvidenceIntegrity(
  m: ArchitectureModel,
  artifacts: EvidenceArtifact[],
): { ok: boolean; issues: EvidenceIntegrityIssue[] } {
  const issues: EvidenceIntegrityIssue[] = [];
  const known = new Set<string>([
    ...m.components.map((c) => `component:${c.id}`),
    ...m.connections.map((c) => `connection:${c.id}`),
    ...m.requirements.map((r) => `requirement:${r.id}`),
    ...m.adrs.map((a) => `adr:${a.id}`),
    ...m.operations.map((o) => `operation:${o.id}`),
    ...m.dataEntities.map((d) => `dataEntity:${d.id}`),
    ...m.slos.map((s) => `slo:${s.id}`),
    ...m.assumptions.map((a) => `assumption:${a.id}`),
    ...m.events.map((e) => `event:${e.id}`),
  ]);
  const entityKinds = ["component", "connection", "requirement", "adr", "operation", "dataEntity", "slo", "assumption", "event"];

  artifacts.forEach((a) => {
    if (!a.source) issues.push({ artifactId: a.id, problem: "missing source" });
    if (!a.summary || a.summary.length < 3) issues.push({ artifactId: a.id, problem: "missing summary" });
    if (!a.createdAt) issues.push({ artifactId: a.id, problem: "missing createdAt timestamp" });
    if (!["observed", "simulated", "inferred", "user-authored"].includes(a.kind)) {
      issues.push({ artifactId: a.id, problem: `unknown evidence kind ${String(a.kind)}` });
    }
    a.refs.forEach((r) => {
      const [kind] = r.split(":");
      if (entityKinds.includes(kind) && !known.has(r)) {
        issues.push({ artifactId: a.id, problem: `reference ${r} does not resolve in the model` });
      }
    });
  });
  return { ok: issues.length === 0, issues };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function buildEvidencePack(
  packId: string, artifacts: EvidenceArtifact[], createdAt: string,
): EvidencePack {
  // deterministic ordering: kind, then id — exports are byte-stable
  const ordered = [...artifacts].sort((a, b) =>
    (a.kind + a.id).localeCompare(b.kind + b.id));
  return {
    schemaVersion: EVIDENCE_PACK_VERSION,
    packId,
    createdAt,
    modelVersion: MODEL_VERSION,
    artifacts: ordered,
  };
}

export function serializeEvidencePack(pack: EvidencePack): string {
  return JSON.stringify(pack, null, 2);
}

export class EvidencePackError extends Error {}

export function parseEvidencePack(text: string): EvidencePack {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new EvidencePackError(`invalid evidence pack JSON: ${(e as Error).message}`);
  }
  const p = raw as Partial<EvidencePack>;
  if (!p || typeof p !== "object") throw new EvidencePackError("evidence pack is not an object");
  if (p.schemaVersion === undefined || p.schemaVersion > EVIDENCE_PACK_VERSION) {
    throw new EvidencePackError(`unsupported evidence pack schema version ${String(p.schemaVersion)}`);
  }
  if (!Array.isArray(p.artifacts)) throw new EvidencePackError("evidence pack has no artifacts array");
  // integrity of the pack's own shape (references are checked against a model separately)
  p.artifacts.forEach((a) => {
    if (!a.id || !a.kind || !a.source || !a.createdAt) {
      throw new EvidencePackError(`artifact ${String(a.id)} is missing required provenance fields`);
    }
  });
  return p as EvidencePack;
}

/** Kind summary for UI: how many artifacts of each kind support a view. */
export function kindSummary(artifacts: EvidenceArtifact[]): Record<EvidenceKind, number> {
  const out: Record<EvidenceKind, number> = { observed: 0, simulated: 0, inferred: 0, "user-authored": 0 };
  artifacts.forEach((a) => { out[a.kind] += 1; });
  return out;
}
