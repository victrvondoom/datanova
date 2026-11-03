/**
 * Run persistence — localStorage behind an injectable storage interface (same
 * pattern as the trail's progress store). Runs survive refresh and app
 * restart; the UI recovers its state from these records, never from
 * in-memory-only state.
 */

import type { RunState } from "./types";

export interface RunStore {
  list(tenantId: string): RunState[];
  get(tenantId: string, runId: string): RunState | null;
  save(run: RunState): void;
  delete(tenantId: string, runId: string): boolean;
  clear(tenantId: string): void;
}

const KEY = "datanova-agent-runs-v1";

const readAll = (storage: Storage): Record<string, RunState> => {
  try { return JSON.parse(storage.getItem(KEY) ?? "{}"); } catch { return {}; }
};
const writeAll = (storage: Storage, all: Record<string, RunState>): void => {
  storage.setItem(KEY, JSON.stringify(all));
};

export const createRunStore = (storage: Storage): RunStore => {
  const tenantFilter = (all: Record<string, RunState>, tenantId: string): RunState[] =>
    Object.values(all).filter((r) => r.tenantId === tenantId);
  return {
    list(tenantId) { return tenantFilter(readAll(storage), tenantId); },
    get(tenantId, runId) {
      const run = readAll(storage)[runId];
      // tenant isolation: cross-tenant reads are rejected, not leaked
      return run && run.tenantId === tenantId ? run : null;
    },
    save(run) { const all = readAll(storage); all[run.id] = run; writeAll(storage, all); },
    delete(tenantId, runId) {
      const all = readAll(storage);
      if (all[runId]?.tenantId !== tenantId) return false;
      delete all[runId];
      writeAll(storage, all);
      return true;
    },
    clear(tenantId) {
      const all = readAll(storage);
      for (const [id, run] of Object.entries(all)) {
        if (run.tenantId === tenantId) delete all[id];
      }
      writeAll(storage, all);
    },
  };
};

/** Serialize → parse round-trip: the resume-after-restart boundary. */
export const persistRoundTrip = (run: RunState): RunState => JSON.parse(JSON.stringify(run));
