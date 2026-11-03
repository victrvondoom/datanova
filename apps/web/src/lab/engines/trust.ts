/**
 * Task 21 — Trust-Boundary Architecture Mapper.
 *
 * Trust comes from zones + enforced controls, not from a component's position
 * in the diagram. Crossings are enumerated, controls are mapped to them, and
 * sensitive/privileged crossings without controls are flagged — with
 * documented exceptions (securityNote) accepted as intentional.
 */

import type { ArchitectureModel, BoundaryControl, Finding, TrustZone } from "../model";
import { finding } from "../model";

export interface BoundaryCrossing {
  connectionId: string;
  from: string;
  to: string;
  fromZone: TrustZone | null;
  toZone: TrustZone | null;
  /** +1 = toward higher trust, -1 = toward lower trust, 0 = same level */
  trustDelta: number;
  controls: BoundaryControl[];
  exception?: string;
}

const TRUST_RANK: Record<string, number> = { internet: 0, dmz: 1, trusted: 2, privileged: 3 };

export function crossings(m: ArchitectureModel): BoundaryCrossing[] {
  return m.connections.map((cn) => {
    const fromZone = m.zones.find((z) => z.id === m.components.find((c) => c.id === cn.from)?.zoneId) ?? null;
    const toZone = m.zones.find((z) => z.id === m.components.find((c) => c.id === cn.to)?.zoneId) ?? null;
    const trustDelta = fromZone && toZone ? TRUST_RANK[toZone.trust] - TRUST_RANK[fromZone.trust] : 0;
    return {
      connectionId: cn.id, from: cn.from, to: cn.to,
      fromZone, toZone, trustDelta,
      controls: cn.controls ?? [],
      exception: cn.securityNote,
    };
  }).filter((c) => c.fromZone && c.toZone && c.fromZone.id !== c.toZone.id);
}

/** Task 21.4 — sensitive/privileged paths crossing without documented controls. */
export function analyzeBoundaries(m: ArchitectureModel): { crossings: BoundaryCrossing[]; findings: Finding[] } {
  const cr = crossings(m);
  const findings: Finding[] = [];

  cr.forEach((c) => {
    if (c.exception) {
      findings.push(finding(
        "trust", `trust-exception:${c.connectionId}`, "info",
        `Boundary crossing ${c.from} -> ${c.to} has a documented exception`,
        c.exception,
        [{ ref: `connection:${c.connectionId}`, detail: "intentional, reviewed exception" }],
      ));
      return;
    }
    if (c.fromZone?.trust === "internet") {
      if (!c.controls.includes("authn")) {
        findings.push(finding(
          "trust", `trust-inbound:${c.connectionId}`, "critical",
          `Unauthenticated entry from the internet: ${c.from} -> ${c.to}`,
          `This crossing enters ${c.toZone?.name} without authentication. Anyone can invoke ${c.to}.`,
          [{ ref: `connection:${c.connectionId}`, detail: `controls: ${c.controls.join(", ") || "none"}` }],
        ));
      }
      if (!c.controls.includes("ratelimit")) {
        findings.push(finding(
          "trust", `trust-flood:${c.connectionId}`, "warning",
          `Internet-facing crossing ${c.from} -> ${c.to} has no rate limit`,
          "Any client can send unbounded traffic into this edge; backend overload becomes trivially reachable.",
          [{ ref: `connection:${c.connectionId}`, detail: "no ratelimit control declared" }],
        ));
      }
    } else if (c.trustDelta > 0 && c.toZone?.trust === "privileged") {
      if (!c.controls.includes("encryption") && !c.controls.includes("authn")) {
        findings.push(finding(
          "trust", `trust-privileged:${c.connectionId}`, "critical",
          `Unprotected access to the privileged zone: ${c.from} -> ${c.to}`,
          `Neither encryption nor service authentication is declared on this path into ${c.toZone?.name}.`,
          [{ ref: `connection:${c.connectionId}`, detail: `controls: ${c.controls.join(", ") || "none"}` }],
        ));
      }
    }
    if (c.trustDelta < 0 && !c.controls.includes("encryption")) {
      findings.push(finding(
        "trust", `trust-outbound:${c.connectionId}`, "critical",
        `Unprotected flow from ${c.from} to lower-trust ${c.toZone?.name}: ${c.to}`,
        `Data crossing into ${c.toZone?.name} is not declared encrypted in transit.`,
        [{ ref: `connection:${c.connectionId}`, detail: `controls: ${c.controls.join(", ") || "none"}` }],
      ));
    }
  });

  return { crossings: cr, findings };
}
