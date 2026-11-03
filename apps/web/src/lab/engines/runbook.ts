/**
 * Task 30 — Recovery Runbook Generator.
 *
 * Generates scenario-specific recovery instructions from the architecture's
 * dependencies and failure paths: ordered steps with preconditions, expected
 * outcomes, risks, verification (never assuming "restarted = healthy"), and
 * escalation when automated recovery is unsafe.
 */

import type { ArchitectureModel, Finding } from "../model";
import { finding } from "../model";
import { blastRadius } from "./blastradius";

export interface RunbookStep {
  order: number;
  action: string;
  precondition: string;
  expectedOutcome: string;
  risk: string;
  rollback: string;
}

export interface Runbook {
  scenario: string;
  componentId: string;
  steps: RunbookStep[];
  verification: string[];
  escalation: { condition: string; action: string }[];
  evidence: string[];
}

const KIND_PLAYBOOK: Record<string, { mitigation: string[]; verification: string[] }> = {
  database: {
    mitigation: ["check replication lag and replica health before any failover", "fail over to a healthy replica; do not restart the primary while it holds writes"],
    verification: ["write path succeeds end-to-end (a real write, not a health ping)", "read-after-write check passes on the operation that failed"],
  },
  objectstore: {
    mitigation: ["verify bucket/store availability and quota", "restore accessibility before restarting writers (restarting writers first amplifies the outage)"],
    verification: ["a document upload and a download both succeed"],
  },
  queue: {
    mitigation: ["inspect depth and consumer lag; check for poison messages", "scale consumers (workers) before producers resume full rate"],
    verification: ["depth trends to zero under normal arrival rate", "no job exceeded its processing deadline while the queue was backed up"],
  },
  worker: {
    mitigation: ["restart workers in batches (never all at once) to avoid a capacity cliff", "verify the queue drains after restart"],
    verification: ["processing rate >= arrival rate (depth decreasing)", "error rate on processed jobs back to baseline"],
  },
  cache: {
    mitigation: ["flush stale entries only if the underlying store is healthy", "let the TTL handle convergence if staleness is acceptable"],
    verification: ["cache hit rate recovers", "no stale reads beyond the documented TTL"],
  },
  service: {
    mitigation: ["roll back the last deployment if the failure followed it", "restart instances behind the load balancer one at a time"],
    verification: ["synthetic request through the full path succeeds", "dependency error rate at baseline"],
  },
  external: {
    mitigation: ["check the provider status page before changing anything locally", "enable/verify the fallback path if one exists; otherwise queue work for later"],
    verification: ["retry with backoff succeeds against the provider", "no duplicate side effects were created during retries (check idempotency)"],
  },
  gateway: {
    mitigation: ["check TLS/rate-limit config before restarting (config drift is the usual cause)", "restart only after confirming backends are healthy"],
    verification: ["all critical routes answer from outside the network", "latency back within the SLO window"],
  },
  analytics: {
    mitigation: ["analytics may lag by design — verify the processing pipeline is unaffected before acting", "replay the event backlog once ingestion recovers"],
    verification: ["freshness within the documented staleness bound"],
  },
  client: {
    mitigation: ["verify backend health before shipping client changes", "check error rates by client version"],
    verification: ["error rate uniform across versions"],
  },
};

export function generateRunbook(m: ArchitectureModel, componentId: string): Runbook {
  const comp = m.components.find((c) => c.id === componentId);
  if (!comp) throw new Error(`unknown component ${componentId}`);
  const br = blastRadius(m, componentId, "down");
  const play = KIND_PLAYBOOK[comp.kind] ?? KIND_PLAYBOOK.service;

  const steps: RunbookStep[] = play.mitigation.map((action, i) => ({
    order: i + 1,
    action,
    precondition: i === 0 ? "the failure is confirmed on this component (alert + evidence), not a downstream symptom" : `step ${i} completed with the expected outcome`,
    expectedOutcome: "the component returns to serving its primary function",
    risk: comp.kind === "database" || comp.kind === "objectstore"
      ? "this component owns authoritative data — a wrong action here can lose data permanently"
      : "a wrong action can amplify the outage to healthy components",
    rollback: "every action here must be reversible: record the previous state before changing it",
  }));

  const impactedOps = br.impactedOperations.map((o) => o.operationName);
  const verification = [
    ...play.verification,
    impactedOps.length > 0
      ? `the impacted user-visible operations recover: ${impactedOps.join(", ")}`
      : "the component's own operation recovers",
    "recovery is verified against the error budget, not against a single successful request",
  ];

  const escalation = [] as { condition: string; action: string }[];
  if (comp.kind === "database" || comp.kind === "objectstore") {
    escalation.push({
      condition: "data loss is suspected or replication is broken",
      action: "STOP automated actions and engage the on-call data owner — automated recovery is unsafe when authoritative data is at risk",
    });
  }
  if (impactedOps.some((name) => /checkout|payment|charge/i.test(name))) {
    escalation.push({
      condition: "the failing path touches payment",
      action: "engage the payments owner before any retry storm: verify idempotency first, or manual reconciliation will be needed",
    });
  }
  if (escalation.length === 0) {
    escalation.push({
      condition: "the component does not recover after the steps above",
      action: "escalate to the component owner — automated recovery is not modeled for this kind",
    });
  }

  return {
    scenario: `Recovery from ${comp.name} (${comp.kind}) failure`,
    componentId,
    steps,
    verification,
    escalation,
    evidence: [
      `component:${componentId}`,
      ...br.impactedOperations.map((o) => `operation:${o.operationId}`),
      ...br.protectedByBoundaries.map((cn) => `connection:${cn}`),
    ],
  };
}

/** Task 30.5 — every generated step must reference existing components only. */
export function validateRunbook(m: ArchitectureModel, rb: Runbook): Finding[] {
  const findings: Finding[] = [];
  const ids = new Set(m.components.map((c) => c.id));
  if (!ids.has(rb.componentId)) {
    findings.push(finding("runbook", "runbook-unknown-component", "critical", "Runbook references an unknown component", rb.componentId, [{ ref: `component:${rb.componentId}`, detail: "unknown" }]));
  }
  if (rb.steps.length === 0) {
    findings.push(finding("runbook", "runbook-empty", "warning", "Runbook has no recovery steps", "generation produced an empty playbook", [{ ref: `component:${rb.componentId}`, detail: "no steps" }]));
  }
  if (rb.verification.length === 0) {
    findings.push(finding("runbook", "runbook-no-verification", "critical", "Runbook does not verify recovery", "restarting a component is not proof of recovery", [{ ref: `component:${rb.componentId}`, detail: "no verification steps" }]));
  }
  return findings;
}
