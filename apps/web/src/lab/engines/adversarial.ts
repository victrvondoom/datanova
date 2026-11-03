/**
 * Task 25 — Adversarial Architecture Path Generator.
 *
 * Reviews the architecture from the perspective of misuse: flood, duplicate
 * operations, invalid identity, queue flooding, dependency exhaustion, and
 * sensitive-data exposure. Each scenario lists the architecture paths that
 * ENABLE it, grounded in the canonical model, with mitigations and their
 * operational trade-offs. The engine is pure and local: adversarial
 * "experiments" only ever transform in-memory model data — no network, no
 * side effects, no real traffic can be generated.
 */

import type { ArchitectureModel, Finding } from "../model";
import { finding } from "../model";

export interface ThreatScenario {
  id: string;
  name: string;
  description: string;
  /** which model property enables this scenario */
  enabledBy: (m: ArchitectureModel) => string[];
  mitigation: { control: string; where: string; tradeoff: string };
}

export const THREAT_LIBRARY: ThreatScenario[] = [
  {
    id: "thr-flood",
    name: "Excessive traffic / resource exhaustion at the edge",
    description: "A client sends unbounded traffic; without a rate limit, backend capacity is consumed and legitimate users are starved.",
    enabledBy: (m) => m.connections
      .filter((cn) => m.components.find((c) => c.id === cn.from)?.kind === "client" && !(cn.controls ?? []).includes("ratelimit"))
      .map((cn) => `${cn.from} -> ${cn.to} (connection:${cn.id}, no ratelimit)`),
    mitigation: { control: "ratelimit", where: "the client-facing edge connection", tradeoff: "legitimate bursts are throttled too; limits need tuning and monitoring" },
  },
  {
    id: "thr-duplicate",
    name: "Duplicate operations (retries / double submits)",
    description: "Retries or double clicks re-submit a mutating operation; without idempotency, side effects duplicate (e.g. double charge).",
    enabledBy: (m) => m.components
      .filter((c) => (c.kind === "service" || c.kind === "worker") && c.config.idempotent !== true &&
        m.connections.some((cn) => cn.from === c.id && (cn.access === "write" || cn.access === "readwrite")))
      .map((c) => `${c.id} mutates data without idempotency`),
    mitigation: { control: "idempotency keys", where: "every mutating service", tradeoff: "key lifecycle (storage, expiry, reuse policy) and payload validation become new operational concerns" },
  },
  {
    id: "thr-identity",
    name: "Invalid identity context reaching sensitive data",
    description: "A request path from a client to sensitive data with no authentication/authorization control lets untrusted callers invoke it.",
    enabledBy: (m) => {
      const sensitive = new Set(m.dataEntities.filter((d) => d.classification === "sensitive" || d.classification === "pii").map((d) => d.id));
      const out: string[] = [];
      m.operations.forEach((o) => {
        const touches = m.connections.some((cn) => cn.operationIds.includes(o.id) &&
          (sensitive.has(cn.to) || [...sensitive].some(() => false)));
        const fromClient = m.connections.some((cn) => cn.operationIds.includes(o.id) && m.components.find((c) => c.id === cn.from)?.kind === "client");
        const hasAuthn = m.connections.some((cn) => cn.operationIds.includes(o.id) && (cn.controls ?? []).includes("authn"));
        if (touches && fromClient && !hasAuthn) out.push(`operation ${o.id} (${o.name})`);
      });
      return out;
    },
    mitigation: { control: "authn + authz controls", where: "client-facing edges of sensitive operations", tradeoff: "identity propagation must be designed through async hops; misconfigured policies lock out legitimate users" },
  },
  {
    id: "thr-queueflood",
    name: "Queue flooding / backlog poisoning",
    description: "Producers enqueue unbounded work; a full queue drops jobs or a poisoned backlog delays everything behind it.",
    enabledBy: (m) => m.components
      .filter((c) => c.kind === "queue" && !m.connections.some((cn) => cn.to === c.id && (cn.controls ?? []).includes("ratelimit")))
      .map((c) => `${c.id} accepts unbounded ingress (no rate-limited producer edge)`),
    mitigation: { control: "producer-side rate limit + DLQ", where: "edges producing into queues", tradeoff: "rate limiting producers drops legitimate work under bursts; a DLQ needs triage tooling" },
  },
  {
    id: "thr-depexhaust",
    name: "Dependency exhaustion via retry storms",
    description: "Callers with retries hammering a degraded dependency amplify load and prevent its recovery.",
    enabledBy: (m) => m.components
      .filter((c) => Number(c.config.retryMax ?? 0) > 3)
      .map((c) => `${c.id} retries up to ${c.config.retryMax} times — amplification up to ${1 + Number(c.config.retryMax)}x`),
    mitigation: { control: "capped retries with exponential backoff + circuit breaker", where: "callers of flaky dependencies", tradeoff: "a circuit breaker adds a new failure mode (premature open) that must be tuned and observable" },
  },
  {
    id: "thr-exposure",
    name: "Sensitive-data exposure across boundaries",
    description: "Sensitive data crosses into lower-trust zones without encryption or documented exception.",
    enabledBy: (m) => m.dataEntities
      .filter((d) => d.classification === "sensitive" || d.classification === "pii")
      .flatMap((d) => {
        const holders = [d.ownerComponentId, ...(d.copies ?? []).map((c) => c.componentId)];
        return m.connections
          .filter((cn) => holders.includes(cn.from))
          .filter((cn) => {
            const from = m.components.find((c) => c.id === cn.from);
            const to = m.components.find((c) => c.id === cn.to);
            const rank = { internet: 0, dmz: 1, trusted: 2, privileged: 3 } as Record<string, number>;
            const ft = m.zones.find((z) => z.id === from?.zoneId)?.trust;
            const tt = m.zones.find((z) => z.id === to?.zoneId)?.trust;
            return ft && tt && rank[tt] < rank[ft] && !(cn.controls ?? []).includes("encryption") && !cn.securityNote;
          })
          .map((cn) => `"${d.name}" flows ${cn.from} -> ${cn.to} unencrypted (connection:${cn.id})`);
      }),
    mitigation: { control: "encryption in transit", where: "every crossing toward lower-trust zones", tradeoff: "minor CPU/key-management overhead; the real cost is auditing every crossing" },
  },
];

export interface AdversarialResult {
  scenarioId: string;
  enabled: boolean;
  enablingPaths: string[];
  mitigation: ThreatScenario["mitigation"];
}

/** Task 25.2 — find paths enabling each scenario. */
export function reviewAdversarially(m: ArchitectureModel): { results: AdversarialResult[]; findings: Finding[] } {
  const results: AdversarialResult[] = THREAT_LIBRARY.map((s) => {
    const paths = s.enabledBy(m);
    return { scenarioId: s.id, enabled: paths.length > 0, enablingPaths: paths, mitigation: s.mitigation };
  });
  const findings: Finding[] = results.filter((r) => r.enabled).map((r) => {
    const s = THREAT_LIBRARY.find((x) => x.id === r.scenarioId) as ThreatScenario;
    return finding(
      "adversarial", `adversarial:${r.scenarioId}`, "critical",
      `Abuse case enabled: ${s.name}`,
      `${s.description} Enabled by: ${r.enablingPaths.join("; ")}. Mitigation: ${r.mitigation.control} at ${r.mitigation.where} — trade-off: ${r.mitigation.tradeoff}.`,
      r.enablingPaths.map((p) => ({ ref: p.slice(p.indexOf("(connection:") + 11, p.indexOf(")")) || "model", detail: `enables ${s.id}` })),
    );
  });
  return { results, findings };
}
