/**
 * Campaign 07 — Task 04: Immutable Operational Snapshots & Event History
 *
 * Append-only observation store, time-window indexing, deterministic content
 * hashes, and reproducible state reconstruction.
 */

import { sha256Sync, canonicalJsonStringify, type OperationalEvidenceEnvelope } from "./envelope";
import type { IntendedGraph, ConfiguredGraph, ObservedGraph, DerivedGraph } from "./models";

export interface OperationalSnapshot {
  snapshotId: string;
  timestamp: string;
  workspaceId: string;
  architectureVersion: number;
  intendedHash: string;
  configuredHash: string;
  observedHash: string;
  derivedHash: string;
  evidenceCount: number;
  evidenceIds: string[];
  intended: IntendedGraph;
  configured: ConfiguredGraph;
  observed: ObservedGraph;
  derived: DerivedGraph;
}

export interface OperationalEvent {
  eventId: string;
  timestamp: string;
  type: "evidence_ingested" | "reconciliation_performed" | "drift_acknowledged" | "incident_opened" | "change_analyzed";
  payloadHash: string;
  summary: string;
  data: Record<string, unknown>;
}

export class OperationalHistoryStore {
  private envelopes: Map<string, OperationalEvidenceEnvelope> = new Map();
  private events: OperationalEvent[] = [];
  private snapshots: OperationalSnapshot[] = [];

  constructor(private readonly workspaceId: string = "default") {}

  /** Ingest an evidence envelope (idempotent: duplicates ignored) */
  public appendEnvelope(envelope: OperationalEvidenceEnvelope): boolean {
    if (this.envelopes.has(envelope.evidenceId)) {
      return false; // Already present
    }
    this.envelopes.set(envelope.evidenceId, envelope);

    this.appendEvent({
      type: "evidence_ingested",
      summary: `Ingested ${envelope.sourceType} from ${envelope.sourceSystem} (${envelope.evidenceId})`,
      data: {
        evidenceId: envelope.evidenceId,
        sourceType: envelope.sourceType,
        sourceSystem: envelope.sourceSystem,
        observedTime: envelope.observedTime,
      },
    });

    return true;
  }

  /** Append an immutable audit event */
  public appendEvent(event: Omit<OperationalEvent, "eventId" | "timestamp" | "payloadHash">): OperationalEvent {
    const timestamp = new Date().toISOString();
    const payloadHash = sha256Sync(canonicalJsonStringify(event.data));
    const eventId = `evt-${sha256Sync(`${timestamp}:${this.events.length}:${payloadHash}`).slice(0, 12)}`;

    const fullEvent: OperationalEvent = {
      ...event,
      eventId,
      timestamp,
      payloadHash,
    };

    this.events.push(fullEvent);
    return fullEvent;
  }

  /** Create an immutable operational snapshot representing system state at this instant */
  public createSnapshot(
    architectureVersion: number,
    intended: IntendedGraph,
    configured: ConfiguredGraph,
    observed: ObservedGraph,
    derived: DerivedGraph
  ): OperationalSnapshot {
    const timestamp = new Date().toISOString();
    const intendedHash = sha256Sync(canonicalJsonStringify(intended));
    const configuredHash = sha256Sync(canonicalJsonStringify(configured));
    const observedHash = sha256Sync(canonicalJsonStringify(observed));
    const derivedHash = sha256Sync(canonicalJsonStringify(derived));

    const evidenceIds = Array.from(this.envelopes.keys());
    const snapshotId = `snap-${sha256Sync(`${timestamp}:${intendedHash}:${observedHash}`).slice(0, 12)}`;

    const snapshot: OperationalSnapshot = {
      snapshotId,
      timestamp,
      workspaceId: this.workspaceId,
      architectureVersion,
      intendedHash,
      configuredHash,
      observedHash,
      derivedHash,
      evidenceCount: evidenceIds.length,
      evidenceIds,
      intended,
      configured,
      observed,
      derived,
    };

    this.snapshots.push(snapshot);

    this.appendEvent({
      type: "reconciliation_performed",
      summary: `Created operational snapshot ${snapshotId} with ${derived.driftCount} drift finding(s)`,
      data: {
        snapshotId,
        architectureVersion,
        driftCount: derived.driftCount,
      },
    });

    return snapshot;
  }

  public getEnvelopes(): OperationalEvidenceEnvelope[] {
    return Array.from(this.envelopes.values());
  }

  public getEnvelopesByWindow(startTime: string, endTime: string): OperationalEvidenceEnvelope[] {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    return Array.from(this.envelopes.values()).filter((e) => {
      const t = new Date(e.observedTime).getTime();
      return t >= start && t <= end;
    });
  }

  public getEvents(): OperationalEvent[] {
    return [...this.events];
  }

  public getSnapshots(): OperationalSnapshot[] {
    return [...this.snapshots];
  }

  public getSnapshot(snapshotId: string): OperationalSnapshot | undefined {
    return this.snapshots.find((s) => s.snapshotId === snapshotId);
  }

  public clear(): void {
    this.envelopes.clear();
    this.events = [];
    this.snapshots = [];
  }
}
