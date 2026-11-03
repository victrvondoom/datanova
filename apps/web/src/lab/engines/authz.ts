/**
 * Task 23 — Authorization Policy Flow Simulator.
 *
 * Default-deny policy evaluation, enforcement-responsibility mapping along
 * request paths, and an enforcement-gap analyzer for sensitive operations
 * with no authorization decision or untrusted identity propagation.
 */

import type { ArchitectureModel, Finding, PolicyRule } from "../model";
import { finding } from "../model";

export type Decision = "allow" | "deny" | "default-deny";

/** Task 23.1/23.3 — deterministic decision (deny overrides allow; default deny). */
export function decide(policies: PolicyRule[], principal: string, action: string, resource: string): { decision: Decision; matched: PolicyRule[] } {
  const matching = policies.filter((p) =>
    p.principal === principal && p.action === action && p.resource === resource);
  if (matching.some((p) => p.effect === "deny")) {
    return { decision: "deny", matched: matching.filter((p) => p.effect === "deny") };
  }
  if (matching.some((p) => p.effect === "allow")) {
    return { decision: "allow", matched: matching.filter((p) => p.effect === "allow") };
  }
  return { decision: "default-deny", matched: [] };
}

export interface EnforcementPoint {
  connectionId: string;
  enforcer: string;
  target: string;
  operationIds: string[];
}

/** Task 23.2 — which component enforces authorization on which edge. */
export function enforcementPoints(m: ArchitectureModel): EnforcementPoint[] {
  return m.connections
    .filter((cn) => (cn.controls ?? []).includes("authz"))
    .map((cn) => ({
      connectionId: cn.id, enforcer: cn.from, target: cn.to, operationIds: [...cn.operationIds],
    }));
}

/** Task 23.4 — sensitive operations with no authorization on their client path. */
export interface EnforcementGap {
  operationId: string;
  entityId: string;
  reason: string;
  evidence: string[];
}

export function enforcementGaps(m: ArchitectureModel): { gaps: EnforcementGap[]; findings: Finding[] } {
  const enforcers = enforcementPoints(m);
  const gaps: EnforcementGap[] = [];

  m.dataEntities
    .filter((d) => d.classification === "sensitive" || d.classification === "pii")
    .forEach((d) => {
      // operations that read or write this entity's owner/copy holders
      const holders = [d.ownerComponentId, ...(d.copies ?? []).map((c) => c.componentId)];
      m.operations.forEach((o) => {
        const touches = m.connections.some((cn) =>
          cn.operationIds.includes(o.id) && holders.includes(cn.to));
        if (!touches) return;
        const clientEntry = m.connections.some((cn) =>
          cn.operationIds.includes(o.id) &&
          m.components.find((c) => c.id === cn.from)?.kind === "client");
        const hasAuthz = m.connections.some((cn) =>
          cn.operationIds.includes(o.id) && (cn.controls ?? []).includes("authz"));
        if (clientEntry && !hasAuthz) {
          gaps.push({
            operationId: o.id, entityId: d.id,
            reason: `operation "${o.name}" reaches sensitive "${d.name}" from a client edge with no authorization control on its path`,
            evidence: [`operation:${o.id}`, `dataEntity:${d.id}`, ...enforcers.filter((e) => e.operationIds.includes(o.id)).map((e) => `connection:${e.connectionId}`)],
          });
        }
        // untrusted identity propagation: async hop toward a mutating component without authz
        const asyncMutating = m.connections.some((cn) =>
          cn.operationIds.includes(o.id) && cn.kind !== "sync" &&
          (cn.access === "write" || cn.access === "readwrite") &&
          !(cn.controls ?? []).includes("authz"));
        if (asyncMutating) {
          gaps.push({
            operationId: o.id, entityId: d.id,
            reason: `operation "${o.name}" mutates "${d.name}" over an asynchronous hop without an authorization decision — identity/context may be lost in transit`,
            evidence: [`operation:${o.id}`, `dataEntity:${d.id}`],
          });
        }
      });
    });

  const findings: Finding[] = gaps.map((g) => finding(
    "authz", `authz-gap:${g.operationId}:${g.entityId}`, "critical",
    `Authorization gap on operation ${g.operationId}`,
    g.reason,
    g.evidence.map((e) => ({ ref: e, detail: "enforcement gap evidence" })),
  ));
  return { gaps, findings };
}

/** Least-privilege review: principals with allow-rules on sensitive entities. */
export function leastPrivilegeReview(m: ArchitectureModel): Finding[] {
  const findings: Finding[] = [];
  const policies = m.policies ?? [];
  const sensitive = new Set(
    m.dataEntities.filter((d) => d.classification === "sensitive" || d.classification === "pii").map((d) => d.id));
  const byPrincipal = new Map<string, PolicyRule[]>();
  policies.forEach((p) => byPrincipal.set(p.principal, [...(byPrincipal.get(p.principal) ?? []), p]));
  byPrincipal.forEach((rules, principal) => {
    const sensitiveAllows = rules.filter((r) => r.effect === "allow" && sensitive.has(r.resource));
    if (sensitiveAllows.length > 0 && rules.some((r) => r.action === "*")) {
      findings.push(finding(
        "authz", `authz-wildcard:${principal}`, "critical",
        `Principal "${principal}" holds a wildcard action`,
        "A wildcard allow defeats least privilege — scope it to explicit actions.",
        [{ ref: `policy:${principal}`, detail: "wildcard allow" }],
      ));
    }
  });
  if (policies.length === 0) {
    findings.push(finding(
      "authz", "authz-empty", "warning",
      "No authorization policies are declared",
      "Authorization cannot be simulated — every access decision is default-deny with no documented allow rules.",
      [{ ref: `model:${m.id}`, detail: "no policies" }],
    ));
  }
  return findings;
}
