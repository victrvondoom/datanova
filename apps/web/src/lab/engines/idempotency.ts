/**
 * Task 19 — Idempotency Lifecycle Debugger.
 *
 * A deterministic state machine for idempotency keys: creation, request
 * binding, processing, result storage, expiration, and duplicate detection —
 * including the concurrent-duplicate case and key misuse.
 */

export type KeyState = "created" | "processing" | "completed" | "failed" | "expired";

export interface IdempotencyRecord {
  key: string;
  operation: string;
  /** binding: the payload hash this key is bound to */
  payloadHash: string;
  state: KeyState;
  storedResult?: string;
  createdAt: number;
  expiresAt: number;
}

export interface IdempotencyRequest {
  key: string;
  operation: string;
  payloadHash: string;
  at: number;
}

export interface DispatchOutcome {
  state: KeyState;
  /** how many side effects this dispatch performed (0 = suppressed or rejected) */
  sideEffects: number;
  response: "executed" | "replayed" | "in-flight" | "rejected" | "expired-then-executed";
  reason: string;
}

export interface IdempotencyState {
  records: Record<string, IdempotencyRecord>;
}

export function emptyIdempotencyState(): IdempotencyState {
  return { records: {} };
}

/** Process one request against the idempotency store (pure: returns new state). */
export function dispatch(state: IdempotencyState, req: IdempotencyRequest): { state: IdempotencyState; outcome: DispatchOutcome } {
  const rec = state.records[req.key];
  const ttlMs = 60_000;

  // no record: create + execute (count the side effect)
  if (!rec || rec.state === "expired" || req.at >= rec.expiresAt) {
    const wasExpired = !!rec && req.at >= rec.expiresAt;
    const records = { ...state.records };
    delete records[req.key];
    records[req.key] = {
      key: req.key, operation: req.operation, payloadHash: req.payloadHash,
      state: "processing", createdAt: req.at, expiresAt: req.at + ttlMs,
    };
    return {
      state: { records },
      outcome: {
        state: "processing",
        sideEffects: 1,
        response: wasExpired ? "expired-then-executed" : "executed",
        reason: wasExpired ? "key had expired: a new operation was executed under the reused key" : "first use of the key: operation executed",
      },
    };
  }

  // key exists with a DIFFERENT payload: misuse
  if (rec.payloadHash !== req.payloadHash) {
    return {
      state,
      outcome: {
        state: rec.state,
        sideEffects: 0,
        response: "rejected",
        reason: `key "${req.key}" is bound to a different payload (${rec.payloadHash}); reusing it for another operation would return the wrong result`,
      },
    };
  }

  // same payload duplicates
  if (rec.state === "processing") {
    return {
      state,
      outcome: { state: "processing", sideEffects: 0, response: "in-flight", reason: "an operation with this key is still in flight: the duplicate is parked/returned as in-flight, no second side effect" },
    };
  }
  if (rec.state === "completed") {
    return {
      state,
      outcome: { state: "completed", sideEffects: 0, response: "replayed", reason: `stored result returned: ${rec.storedResult}` },
    };
  }
  // failed: let the retry execute again (failure did not commit a side effect)
  const records = { ...state.records, [req.key]: { ...rec, state: "processing" } };
  return {
    state: { records },
    outcome: { state: "processing", sideEffects: 1, response: "executed", reason: "previous attempt failed without committing: the operation re-executes" },
  };
}

export function complete(state: IdempotencyState, key: string, result: string, at: number): IdempotencyState {
  const rec = state.records[key];
  if (!rec) return state;
  return { records: { ...state.records, [key]: { ...rec, state: "completed", storedResult: result, expiresAt: rec.expiresAt } } };
}

export function fail(state: IdempotencyState, key: string): IdempotencyState {
  const rec = state.records[key];
  if (!rec) return state;
  return { records: { ...state.records, [key]: { ...rec, state: "failed" } } };
}

export function expireAll(state: IdempotencyState, at: number): IdempotencyState {
  const records: Record<string, IdempotencyRecord> = {};
  Object.values(state.records).forEach((r) => {
    records[r.key] = at >= r.expiresAt ? { ...r, state: "expired" } : r;
  });
  return { records };
}

/**
 * Task 19.2 — concurrent duplicate: the second request with the same key
 * arrives while the first is still processing.
 */
export function simulateConcurrentDuplicate(): { events: string[]; sideEffectCount: number } {
  let s = emptyIdempotencyState();
  const events: string[] = [];
  const req: IdempotencyRequest = { key: "pay-123", operation: "charge", payloadHash: "h1", at: 100 };
  const first = dispatch(s, req);
  s = first.state;
  events.push(`t=100 first request: ${first.outcome.response} (${first.outcome.reason})`);
  const second = dispatch(s, req);
  events.push(`t=100 duplicate request (first still processing): ${second.outcome.response} (${second.outcome.reason})`);
  s = complete(s, "pay-123", "charged-once", 150);
  events.push("t=150 first request completed: result stored");
  const third = dispatch(s, req);
  events.push(`t=160 retry after completion: ${third.outcome.response} (${third.outcome.reason})`);
  return { events, sideEffectCount: first.outcome.sideEffects + second.outcome.sideEffects + third.outcome.sideEffects };
}
