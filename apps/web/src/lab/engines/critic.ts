/**
 * Task 38 — Evidence-Grounded Architecture Critic.
 *
 * Deterministic critique rules grounded in the canonical model. Every finding
 * names the exact component/connection/config/requirement/missing assumption,
 * recommendations are conditional (with explicit "when this does NOT apply"),
 * and unjustified complexity is itself criticized. No external AI is required:
 * the core product is fully functional without any model provider, and any
 * future AI layer may only paraphrase these evidence-backed findings.
 */

import type { ArchitectureModel, Finding } from "../model";
import { finding } from "../model";
import { blastRadius, criticality } from "./blastradius";
import { analyzeIntent } from "./intent";
import { extractGenome } from "./genome";

export interface CritiqueRule {
  id: string;
  name: string;
  evaluate: (m: ArchitectureModel) => Finding[];
}

const rec = (applies: string, notApplies: string): string =>
  `Recommendation: ${applies} This does NOT apply when: ${notApplies}`;

export const CRITIC_RULES: CritiqueRule[] = [
  {
    id: "spof",
    name: "Single point of failure on critical paths",
    evaluate: (m) => {
      const out: Finding[] = [];
      m.components.forEach((c) => {
        if (c.kind === "client") return; // a client failing trivially blocks its own requests
        const br = blastRadius(m, c.id, "down");
        // only operations with an actually DOWNED component count: degraded-only
        // impact (fallbacks) is not a single point of failure
        const criticalOpsHit = br.impactedOperations.filter((o) =>
          o.criticality >= 4 &&
          [...o.directImpactedComponents, ...o.indirectImpactedComponents]
            .some((id) => id !== c.id && br.affectedComponents.find((a) => a.id === id)?.status === "down"));
        if (criticalOpsHit.length === 0) return;
        const redundant = Number(c.config.replicas ?? 1) >= 2 ||
          m.connections.some((cn) => cn.to === c.id && cn.kind !== "sync"); // async buffer in front
        if (!redundant) {
          out.push(finding(
            "critic", `critic-spof:${c.id}`, "critical",
            `Single point of failure: ${c.name}`,
            `Failure of ${c.id} takes down ${criticalOpsHit.map((o) => o.operationName).join(", ")} with no redundancy (replicas=${c.config.replicas ?? 1}) and no async buffer in front. ` +
            rec("add redundancy (replicas) or buffer work asynchronously so the critical operations survive its outage.",
              "the component is a client or an intentionally single-owner authority (e.g. the primary database of a single-writer design) — fix the data layer strategy first."),
            [{ ref: `component:${c.id}`, detail: `impacts: ${criticalOpsHit.map((o) => o.operationId).join(", ")}` }],
          ));
        }
      });
      return out;
    },
  },
  {
    id: "unidempotent-mutations",
    name: "Mutating services without idempotency under retry-capable callers",
    evaluate: (m) => {
      const out: Finding[] = [];
      m.components
        .filter((c) => c.kind === "service" || c.kind === "worker")
        .filter((c) => c.config.idempotent !== true)
        .filter((c) => m.connections.some((cn) =>
          cn.from === c.id && (cn.access === "write" || cn.access === "readwrite")))
        .forEach((c) => {
          const retriers = m.connections.filter((cn) =>
            cn.to === c.id && Number(m.components.find((x) => x.id === cn.from)?.config.retryMax ?? 0) > 0);
          out.push(finding(
            "critic", `critic-idem:${c.id}`, "critical",
            `${c.name} mutates data without idempotency`,
            `${c.id} accepts write operations but does not declare idempotency${retriers.length > 0 ? ` while ${retriers.map((r) => r.from).join(", ")} retry failures` : ""}: retries or redeliveries can duplicate side effects. ` +
            rec("make the operation idempotent with a key lifecycle (bind key to payload, store results, expire keys).",
              "the operation is naturally idempotent (pure read or a set-style overwrite) — document that instead."),
            [{ ref: `component:${c.id}`, detail: "config.idempotent is not true" },
             ...retriers.map((r) => ({ ref: `connection:${r.id}`, detail: "retried by caller" }))],
          ));
        });
      return out;
    },
  },
  {
    id: "unbounded-queue",
    name: "Queues without capacity bounds",
    evaluate: (m) => {
      const out: Finding[] = [];
      m.components.filter((c) => c.kind === "queue" && c.config.capacity === undefined).forEach((c) => {
        out.push(finding(
          "critic", `critic-queue:${c.id}`, "warning",
          `Queue "${c.name}" has no capacity bound`,
          "An unbounded queue converts overload into invisible unbounded memory growth instead of visible backpressure. " +
          rec("declare a capacity and a rejection/DLQ policy.",
            "the queue is a local in-process buffer with a naturally bounded producer — document that bound."),
          [{ ref: `component:${c.id}`, detail: "config.capacity missing" }],
        ));
      });
      return out;
    },
  },
  {
    id: "sync-external",
    name: "Synchronous calls to external dependencies without timeouts",
    evaluate: (m) => {
      const out: Finding[] = [];
      m.connections.filter((cn) => {
        const target = m.components.find((c) => c.id === cn.to);
        return cn.kind === "sync" && target?.kind === "external";
      }).forEach((cn) => {
        const caller = m.components.find((c) => c.id === cn.from);
        if (caller && caller.config.timeoutMs === undefined) {
          out.push(finding(
            "critic", `critic-sync-ext:${cn.id}`, "warning",
            `Synchronous external call without timeout: ${cn.from} -> ${cn.to}`,
            "A hanging third party stalls the caller until its own resources exhaust. " +
            rec("declare a timeout (and a fallback if the operation tolerates it).",
              "the call is a fire-and-forget misclassified as sync — model it async instead."),
            [{ ref: `connection:${cn.id}`, detail: `caller ${cn.from} has no timeoutMs` }],
          ));
        }
      });
      return out;
    },
  },
  {
    id: "complexity-without-requirement",
    name: "Components without requirement mapping (complexity without justification)",
    evaluate: (m) => {
      const out: Finding[] = [];
      const orphans = analyzeIntent(m).filter((f) => f.id.startsWith("intent-orphan:"));
      orphans.forEach((f) => {
        out.push(finding(
          "critic", `critic-orphan:${f.id.split(":")[1]}`, "warning",
          `Unjustified complexity: ${f.title}`,
          `${f.detail} Complexity must be paid for by a requirement — remove the component or document why it exists. ` +
          rec("map the component to a requirement (or an explicitly recorded assumption) or remove it.",
            "the component is infrastructure the model does not represent requirements for (e.g. shared platform tooling) — record that as its purpose."),
          f.evidence,
        ));
      });
      return out;
    },
  },
];

/** Run all rules: the deterministic, AI-free critic core. */
export function critiqueArchitecture(m: ArchitectureModel): { findings: Finding[]; rulesFired: string[] } {
  const findings = CRITIC_RULES.flatMap((r) => r.evaluate(m));
  return {
    findings,
    rulesFired: CRITIC_RULES.filter((r) => r.evaluate(m).length > 0).map((r) => r.id),
  };
}

/** Summary used by the benchmark: what the critic says about an architecture. */
export function criticSummary(m: ArchitectureModel): { criticals: number; warnings: number; genomeFingerprint: string } {
  const { findings } = critiqueArchitecture(m);
  return {
    criticals: findings.filter((f) => f.severity === "critical").length,
    warnings: findings.filter((f) => f.severity === "warning").length,
    genomeFingerprint: extractGenome(m).fingerprint,
  };
}

/** Criticality context helper for panels. */
export function criticContext(m: ArchitectureModel, componentId: string): { criticality: number | null } {
  const c = criticality(m, componentId);
  return { criticality: c?.score ?? null };
}
