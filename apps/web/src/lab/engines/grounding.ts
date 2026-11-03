/**
 * Campaign 05, Task 10 — Grounded technical explanation layer.
 *
 * Connects critic rules and lab findings to the claim registry: for a finding
 * we can state the claim it rests on, which sources support that claim, what
 * the lab adds beyond the sources, and how confident we honestly are:
 *  - "grounded":        claim is external + sources exist,
 *  - "internal-model":  claim is an assumption/simplification/heuristic,
 *  - "insufficient":    no claim found — the finding must say so instead of
 *                       posturing as established guidance.
 */

import { CLAIMS, type GroundedClaim } from "./claims";
import { SOURCES } from "./sources";
import type { Finding } from "../model";

export type GroundingConfidence = "grounded" | "internal-model" | "insufficient";

export interface GroundedExplanation {
  findingId: string;
  confidence: GroundingConfidence;
  /** claims this finding rests on (usually 1..2) */
  claims: GroundedClaim[];
  /** deduplicated sources backing those claims, with sections */
  sources: { id: string; title: string; url: string; sectionRef: string }[];
  /** what the lab models BEYOND the cited sources */
  deltas: string[];
  /** the recommendation this finding makes, restated for review */
  recommendation: string;
  /** documented exceptions / counterexample summaries (conditional rules) */
  conditions: string[];
}

/** Which claims support which critic rule (the rule→claim wiring). */
const RULE_CLAIMS: Record<string, string[]> = {
  spof: ["claim-spof-redundancy"],
  "unidempotent-mutations": ["claim-idempotency-keys", "claim-retry-storms"],
  "unbounded-queue": ["claim-backpressure"],
  "sync-external": ["claim-timeouts-required", "claim-tail-fanout"],
  "complexity-without-requirement": ["claim-complexity-needs-requirement"],
  orphan: ["claim-complexity-needs-requirement"],
};

/** Engine-family → default claims, for non-critic findings. */
const ENGINE_CLAIMS: Record<string, string[]> = {
  causal: ["claim-causal-rules", "claim-retry-storms"],
  consistency: ["claim-cache-staleness", "claim-cap-partition"],
  slo: ["claim-slo-error-budgets"],
  latency: ["claim-tail-fanout"],
  traffic: ["claim-littles-law", "claim-queue-model-mms"],
  trust: ["claim-zero-trust"],
  authz: ["claim-access-control-rank", "claim-zero-trust"],
  tenant: ["claim-tenant-isolation-spectrum"],
  tenantmatrix: ["claim-tenant-isolation-spectrum", "claim-access-control-rank"],
  saga: ["claim-saga-compensation"],
  idempotency: ["claim-idempotency-keys"],
  chaos: ["claim-chaos-principles"],
  observability: ["claim-trace-model"],
  trace: ["claim-trace-model"],
};

/**
 * Build the grounded explanation for a finding. Findings carry `id` shaped
 * `critic-<rule>:...` (critic) or come from engine families with a known
 * prefix (see model.ts `finding()`). Unknown origins yield "insufficient"
 * rather than an invented citation.
 */
export function explainFinding(finding: Finding): GroundedExplanation {
  let claimIds: string[] = [];
  if (finding.id.startsWith("critic-")) {
    const rule = finding.id.split(":")[0].replace("critic-", "");
    claimIds = RULE_CLAIMS[rule] ?? [];
  } else {
    const family = finding.id.split(":")[0].split("-")[0];
    claimIds = ENGINE_CLAIMS[family] ?? [];
    if (claimIds.length === 0) {
      // try the full prefix (e.g. "slo-window", "trust-crossing")
      claimIds = ENGINE_CLAIMS[finding.id.split(":")[0]] ?? [];
    }
  }
  const claims = claimIds
    .map((id) => CLAIMS.find((c) => c.id === id))
    .filter((c): c is GroundedClaim => Boolean(c));
  const sources = new Map<string, { id: string; title: string; url: string; sectionRef: string }>();
  for (const c of claims) {
    for (const sid of c.sources) {
      const s = SOURCES.find((x) => x.id === sid);
      if (s && !sources.has(sid)) {
        sources.set(sid, { id: s.id, title: s.title, url: s.url, sectionRef: s.sectionRef });
      }
    }
  }
  const external = claims.filter((c) => c.kind === "external");
  const confidence: GroundingConfidence =
    claims.length === 0 ? "insufficient" : external.length > 0 ? "grounded" : "internal-model";
  return {
    findingId: finding.id,
    confidence,
    claims,
    sources: [...sources.values()].sort((a, b) => a.id.localeCompare(b.id)),
    deltas: claims.map((c) => c.labDelta ?? "").filter(Boolean),
    recommendation: finding.detail,
    conditions: extractConditions(finding),
  };
}

/** Critic recommendations carry an explicit "does NOT apply when" clause — surface it. */
function extractConditions(finding: Finding): string[] {
  const idx = finding.detail.indexOf("This does NOT apply when:");
  if (idx === -1) return [];
  return [finding.detail.slice(idx).replace("This does NOT apply when:", "").trim()];
}

/**
 * Aggregate grounding status across a findings set — used by the UI to show
 * honestly how much of the review is externally grounded.
 */
export function groundingSummary(findings: Finding[]): {
  grounded: number;
  internalModel: number;
  insufficient: number;
} {
  const acc = { grounded: 0, internalModel: 0, insufficient: 0 };
  for (const f of findings) {
    const c = explainFinding(f).confidence;
    if (c === "grounded") acc.grounded += 1;
    else if (c === "internal-model") acc.internalModel += 1;
    else acc.insufficient += 1;
  }
  return acc;
}
