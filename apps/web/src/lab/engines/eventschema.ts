/**
 * Task 18 — Event Schema Evolution Laboratory.
 *
 * Deterministic compatibility analysis between event versions, a consumer
 * compatibility map, and an evolution simulation that shows which consumers
 * a proposed change affects under each compatibility strategy.
 */

import type { ArchitectureModel, EventContract, EventVersion } from "../model";

export type Compatibility = "compatible" | "breaking" | "conditional";

export interface CompatibilityReport {
  eventId: string;
  fromVersion: number;
  toVersion: number;
  compatibility: Compatibility;
  changes: { field: string; change: string; effect: Compatibility }[];
  explanation: string;
}

/** Task 18.2 — classify a version change against its consumers. */
export function analyzeCompatibility(prev: EventVersion, next: EventVersion, eventId: string): CompatibilityReport {
  const changes: CompatibilityReport["changes"] = [];
  let worst: Compatibility = "compatible";

  const bump = (c: Compatibility): void => {
    const rank = { compatible: 0, conditional: 1, breaking: 2 } as const;
    if (rank[c] > rank[worst]) worst = c;
  };

  prev.fields.forEach((f) => {
    const after = next.fields.find((x) => x.name === f.name);
    if (!after) {
      const effect = f.required ? "breaking" : "compatible";
      changes.push({ field: f.name, change: "removed", effect });
      bump(effect as Compatibility);
    } else if (after.type !== f.type) {
      changes.push({ field: f.name, change: `type ${f.type} -> ${after.type}`, effect: "breaking" });
      bump("breaking");
    } else if (!f.required && after.required) {
      changes.push({ field: f.name, change: "optional -> required", effect: "conditional" });
      bump("conditional");
    } else if (f.required && !after.required) {
      changes.push({ field: f.name, change: "required -> optional", effect: "compatible" });
    }
  });
  next.fields.forEach((f) => {
    if (!prev.fields.some((x) => x.name === f.name)) {
      const effect = f.required ? "conditional" : "compatible";
      changes.push({ field: f.name, change: `added${f.required ? " (required)" : " (optional)"}`, effect });
      bump(effect as Compatibility);
    }
  });

  const explanation = changes.length === 0
    ? "no field-level changes detected"
    : changes.map((c) => `${c.field}: ${c.change} (${c.effect})`).join("; ");

  return { eventId, fromVersion: prev.version, toVersion: next.version, compatibility: worst, changes, explanation };
}

export interface ConsumerImpact {
  eventId: string;
  consumerComponentId: string;
  maxVersion: number;
  affected: boolean;
  reason: string;
}

/** Task 18.3 — which consumers are affected by the newest version. */
export function consumerMap(m: ArchitectureModel, eventId: string, report: CompatibilityReport): ConsumerImpact[] {
  const consumers = m.consumers.filter((c) => c.eventId === eventId);
  return consumers.map((c) => {
    const behind = c.maxVersion < report.toVersion;
    const affected = report.compatibility === "breaking" ||
      (report.compatibility === "conditional" && behind);
    return {
      eventId, consumerComponentId: c.consumerComponentId, maxVersion: c.maxVersion,
      affected,
      reason: affected
        ? report.compatibility === "breaking"
          ? `v${report.toVersion} contains breaking changes (${report.explanation})`
          : `v${report.toVersion} adds required fields; consumer only understands v${c.maxVersion}`
        : `consumer reads v${c.maxVersion}; change is ${report.compatibility} and tolerated`,
    };
  });
}

/** Task 18.4 — simulate introducing a proposed next version. */
export interface EvolutionSimulation {
  proposed: EventVersion;
  report: CompatibilityReport;
  impactedConsumers: ConsumerImpact[];
  /** a documented safe path: add optional first, require later */
  safeMigrationPath: string[];
}

export function simulateEvolution(m: ArchitectureModel, eventId: string, proposed: EventVersion): EvolutionSimulation {
  const event = m.events.find((e) => e.id === eventId) as EventContract;
  const latest = event.versions.reduce((a, b) => (b.version > a.version ? b : a));
  const report = analyzeCompatibility(latest, proposed, eventId);
  const impacted = consumerMap(m, eventId, report);
  const safeMigrationPath: string[] = [];
  report.changes.forEach((c) => {
    if (c.change.startsWith("added (required)")) {
      safeMigrationPath.push(`v${proposed.version}: add "${c.field}" as optional; consumers ignore unknown fields`);
      safeMigrationPath.push(`v${proposed.version + 1}: make "${c.field}" required once every consumer understands it (expand/contract)`);
    }
    if (c.change === "removed" || c.change.startsWith("type ")) {
      safeMigrationPath.push(`v${proposed.version}: stop producing "${c.field}" only after all consumers stopped reading it (contract)`);
    }
  });
  if (safeMigrationPath.length === 0) safeMigrationPath.push("change is backward-compatible as proposed; deploy producers first, consumers at any time");
  return { proposed, report, impactedConsumers: impacted.filter((i) => i.affected), safeMigrationPath };
}
