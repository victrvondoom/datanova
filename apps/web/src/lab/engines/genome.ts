/**
 * Task 06 — Architecture Genome.
 *
 * A compact, derived fingerprint of the design properties that determine
 * behavior. Traits are EXTRACTED from the canonical model (never hand-entered)
 * and are order-insensitive so semantically equivalent models produce equal
 * fingerprints while meaningful changes are reflected.
 */

import type { ArchitectureModel } from "../model";
import { STATEFUL_KINDS } from "../model";
import { syncDepthFrom } from "./graph";

export interface Trait {
  key: string;
  label: string;
  value: number | string;
  derivedFrom: string;
}

export interface Genome {
  traits: Trait[];
  /** stable, order-insensitive fingerprint string */
  fingerprint: string;
}

export const TRAIT_KEYS = [
  "syncDepth", "statefulStores", "queues", "caches", "externalDeps",
  "retryCoverage", "isolationScore", "redundantComponents", "idempotencyCoverage",
  "asyncEdges", "eventEdges", "operations",
] as const;

export type TraitKey = (typeof TRAIT_KEYS)[number];

export function extractGenome(m: ArchitectureModel): Genome {
  const services = m.components.filter((c) => c.kind === "service" || c.kind === "worker");
  const withRetries = services.filter((c) => Number(c.config.retryMax ?? 0) > 0).length;
  const mutating = services.filter((c) => c.kind === "service");
  const idempotent = mutating.filter((c) => c.config.idempotent === true).length;
  const isolated = m.connections.filter((c) => c.failureBehavior === "isolated").length;

  const traits: Trait[] = [
    { key: "syncDepth", label: "Synchronous dependency depth", value: Math.max(0, ...m.components.map((c) => syncDepthFrom(m, c.id))), derivedFrom: "connections(kind=sync) traversal" },
    { key: "statefulStores", label: "Stateful components", value: m.components.filter((c) => STATEFUL_KINDS.includes(c.kind)).length, derivedFrom: "components.kind" },
    { key: "queues", label: "Queues", value: m.components.filter((c) => c.kind === "queue").length, derivedFrom: "components.kind" },
    { key: "caches", label: "Caches", value: m.components.filter((c) => c.kind === "cache").length, derivedFrom: "components.kind" },
    { key: "externalDeps", label: "External dependencies", value: m.components.filter((c) => c.kind === "external").length, derivedFrom: "components.kind" },
    { key: "retryCoverage", label: "Retry coverage (services+workers)", value: services.length === 0 ? 0 : withRetries / services.length, derivedFrom: "config.retryMax" },
    { key: "isolationScore", label: "Isolated connection fraction", value: m.connections.length === 0 ? 0 : isolated / m.connections.length, derivedFrom: "connections.failureBehavior" },
    { key: "redundantComponents", label: "Components with replicas >= 2", value: m.components.filter((c) => Number(c.config.replicas ?? 1) >= 2).length, derivedFrom: "config.replicas" },
    { key: "idempotencyCoverage", label: "Idempotent service fraction", value: mutating.length === 0 ? 0 : idempotent / mutating.length, derivedFrom: "config.idempotent" },
    { key: "asyncEdges", label: "Async connections", value: m.connections.filter((c) => c.kind === "async").length, derivedFrom: "connections.kind" },
    { key: "eventEdges", label: "Event connections", value: m.connections.filter((c) => c.kind === "event").length, derivedFrom: "connections.kind" },
    { key: "operations", label: "Business operations", value: m.operations.length, derivedFrom: "operations" },
  ];
  return { traits, fingerprint: fingerprintOf(traits) };
}

/** FNV-1a over the sorted key:value serialization — stable across runs and orders. */
export function fingerprintOf(traits: Trait[]): string {
  const canon = [...traits]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((t) => `${t.key}=${typeof t.value === "number" ? t.value.toFixed(4) : t.value}`)
    .join("|");
  let h = 0x811c9dc5;
  for (let i = 0; i < canon.length; i++) {
    h ^= canon.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return `gn-${h.toString(16).padStart(8, "0")}`;
}

export interface TraitDelta {
  key: string;
  label: string;
  before: number | string;
  after: number | string;
  interpretation: string;
}

const INTERPRETATIONS: Record<string, string> = {
  syncDepth: "deeper synchronous chains couple latency and availability of more components",
  queues: "queues decouple producers from consumers at the cost of eventual completion",
  caches: "caches reduce read latency but introduce staleness risk",
  retryCoverage: "retries mask transient faults but amplify load on degraded dependencies",
  isolationScore: "higher isolation limits failure propagation",
  idempotencyCoverage: "idempotency limits duplicate side effects under retries",
  redundancy: "replicas reduce single-point-of-failure risk at higher cost",
};

export function compareGenomes(a: Genome, b: Genome): TraitDelta[] {
  const mapA = new Map(a.traits.map((t) => [t.key, t]));
  return b.traits
    .filter((t) => mapA.get(t.key)?.value !== t.value)
    .map((t) => ({
      key: t.key,
      label: t.label,
      before: mapA.get(t.key)?.value ?? 0,
      after: t.value,
      interpretation: INTERPRETATIONS[t.key] ?? "structural difference with behavioral consequences",
    }));
}
