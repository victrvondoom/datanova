/**
 * Task 04 — Versioned Architecture Design Ledger.
 *
 * Immutable snapshots of meaningful architecture versions with change
 * classification and decision lineage. Snapshots deep-clone the model:
 * later edits to a restored copy never mutate recorded history.
 */

import {
  type ArchitectureModel, type ModelChange, cloneModel, diffModels,
} from "../model";

export interface Snapshot {
  /** monotonic ledger version (1-based) */
  version: number;
  label: string;
  /** ISO timestamp supplied by the caller (pure engine: no Date() here) */
  createdAt: string;
  /** decision lineage: what motivated this snapshot */
  motivation?: string;
  adrId?: string;
  requirementId?: string;
  model: ArchitectureModel;
  /** classification of the diff from the previous snapshot (empty for v1) */
  changes: ModelChange[];
}

export interface Ledger {
  archId: string;
  snapshots: Snapshot[];
}

export function createLedger(archId: string): Ledger {
  return { archId, snapshots: [] };
}

export function takeSnapshot(
  ledger: Ledger, model: ArchitectureModel, meta: { label: string; createdAt: string; motivation?: string; adrId?: string; requirementId?: string },
): Ledger {
  const prev = ledger.snapshots[ledger.snapshots.length - 1];
  const changes = prev ? diffModels(prev.model, model) : [];
  const snap: Snapshot = {
    version: (prev?.version ?? 0) + 1,
    label: meta.label,
    createdAt: meta.createdAt,
    motivation: meta.motivation,
    adrId: meta.adrId,
    requirementId: meta.requirementId,
    model: cloneModel(model),
    changes,
  };
  return { archId: ledger.archId, snapshots: [...ledger.snapshots, snap] };
}

/** Restore returns a fresh clone — recorded history stays immutable. */
export function restore(ledger: Ledger, version: number): ArchitectureModel {
  const snap = ledger.snapshots.find((s) => s.version === version);
  if (!snap) throw new Error(`no snapshot version ${version}`);
  return cloneModel(snap.model);
}

/** Summarize change classes between two snapshot versions (timeline data). */
export function summarizeChanges(changes: ModelChange[]): Record<string, number> {
  const summary: Record<string, number> = {};
  changes.forEach((c) => { summary[c.classification] = (summary[c.classification] ?? 0) + 1; });
  return summary;
}

/** Whether a snapshot meaningfully changed a given class (drift relevance). */
export function touchesClass(changes: ModelChange[], cls: ModelChange["classification"]): boolean {
  return changes.some((c) => c.classification === cls);
}
