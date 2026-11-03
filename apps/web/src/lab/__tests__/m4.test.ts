/**
 * Campaign 03, Milestone 4 tests — consistency contracts (T16), ownership (T17),
 * event schema evolution (T18), idempotency lifecycle (T19), sagas (T20).
 */

import { describe, it, expect } from "vitest";
import { validateModel } from "../model";
import { docflowModel } from "../samples";
import { analyzeConsistency, checkContract, consistencyTimeline } from "../engines/consistency";
import { auditOwnership, entityWriters, refactorAlternatives } from "../engines/ownership";
import { analyzeCompatibility, simulateEvolution } from "../engines/eventschema";
import {
  dispatch, complete, fail, expireAll, emptyIdempotencyState, simulateConcurrentDuplicate,
} from "../engines/idempotency";
import {
  docflowDeleteSaga, validateSaga, failurePaths, executeSaga, type SagaDefinition,
} from "../engines/saga";

// ---------------------------------------------------------------------------
// Task 16 — consistency contracts
// ---------------------------------------------------------------------------

describe("T16 consistency contract visualizer", () => {
  it("the seeded model validates with contracts and access modes", () => {
    expect(validateModel(docflowModel())).toEqual([]);
  });

  it("flags the immediate read-after-write contract violated by the TTL cache path", () => {
    const m = docflowModel();
    const cc = m.consistencyContracts![0];
    const check = checkContract(m, cc);
    expect(check.verdict).toBe("violated");
    expect(check.detail).toContain("TTL");
    expect(check.evidence).toContain("requirement:NFR-3");
    expect(check.evidence.some((e) => e.startsWith("connection:"))).toBe(true);
  });

  it("eventual contracts pass and mark unverifiable staleness honestly", () => {
    const m = docflowModel();
    const check = checkContract(m, m.consistencyContracts![1]);
    expect(check.verdict).toBe("satisfied");
    expect(check.detail).toContain("cannot be verified");
  });

  it("unsupported guarantees are unknown, never silently passed", () => {
    const m = docflowModel();
    m.consistencyContracts![0].readAfterWrite = "immediate";
    m.connections = m.connections.filter((cn) => cn.id !== "cn-up-db" && cn.id !== "cn-worker-db"); // remove every write path
    const check = checkContract(m, m.consistencyContracts![0]);
    expect(check.verdict).toBe("unknown");
    const { checks, findings } = analyzeConsistency(m);
    expect(checks.length).toBe(2);
    expect(findings.find((f) => f.id === "consistency:cc-status")?.severity).toBe("warning");
  });

  it("renders a stale-read timeline with reconciliation", () => {
    const events = consistencyTimeline(docflowModel(), "cc-status", 30);
    expect(events.some((e) => e.stale)).toBe(true);
    expect(events[events.length - 1].note).toContain("reconciled");
  });
});

// ---------------------------------------------------------------------------
// Task 17 — transaction boundary and data ownership
// ---------------------------------------------------------------------------

describe("T17 data ownership auditor", () => {
  it("enumerates writers per entity, including boundary crossings", () => {
    const m = docflowModel();
    const w = entityWriters(m, m.dataEntities.find((d) => d.id === "de-meta")!);
    expect(w.ownerComponentId).toBe("meta-db");
    expect(w.writers.map((x) => x.componentId).sort()).toEqual(["upload-svc", "worker"]);
    expect(w.writers.every((x) => x.crossesBoundary)).toBe(true); // app zone -> data zone
  });

  it("flags duplicated authoritative state and cross-boundary mutations", () => {
    const { violations, findings } = auditOwnership(docflowModel());
    expect(violations.some((v) => v.kind === "duplicate-authority" && v.entityId === "de-meta")).toBe(true);
    expect(violations.some((v) => v.kind === "cross-boundary-mutation")).toBe(true);
    expect(findings.every((f) => f.evidence.length > 0)).toBe(true);
  });

  it("flags unclear ownership when the owner component is missing", () => {
    const m = docflowModel();
    m.dataEntities[0].ownerComponentId = "ghost";
    const { violations } = auditOwnership(m);
    expect(violations.some((v) => v.kind === "unclear-owner" && v.entityId === "de-doc")).toBe(true);
  });

  it("offers context-sensitive alternatives without auto-selecting one", () => {
    const { violations } = auditOwnership(docflowModel());
    const dup = violations.find((v) => v.kind === "duplicate-authority")!;
    const alts = refactorAlternatives(dup);
    expect(alts.length).toBe(3);
    expect(alts.every((a) => a.appliesWhen.length > 0 && a.tradeoff.length > 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Task 18 — event schema evolution
// ---------------------------------------------------------------------------

describe("T18 event schema evolution lab", () => {
  const v1 = () => docflowModel().events[0].versions[0];

  it("classifies optional additions as compatible", () => {
    const next = { version: 2, fields: [...v1().fields, { name: "region", type: "string" as const, required: false, addedIn: 2 }] };
    const r = analyzeCompatibility(v1(), next, "ev-usage");
    expect(r.compatibility).toBe("compatible");
    const sim = simulateEvolution(docflowModel(), "ev-usage", next);
    expect(sim.impactedConsumers).toEqual([]);
  });

  it("classifies required additions as conditional and maps affected consumers", () => {
    const next = { version: 2, fields: [...v1().fields, { name: "tenantId", type: "string" as const, required: true, addedIn: 2 }] };
    const sim = simulateEvolution(docflowModel(), "ev-usage", next);
    expect(sim.report.compatibility).toBe("conditional");
    expect(sim.impactedConsumers.map((c) => c.consumerComponentId)).toEqual(["analytics"]);
    // expand/contract safe migration path is documented
    expect(sim.safeMigrationPath.some((s) => s.includes("add \"tenantId\" as optional"))).toBe(true);
    expect(sim.safeMigrationPath.some((s) => s.includes("expand/contract"))).toBe(true);
  });

  it("classifies removals and type changes as breaking", () => {
    const removed = { version: 2, fields: v1().fields.filter((f) => f.name !== "documentId") };
    expect(analyzeCompatibility(v1(), removed, "ev-usage").compatibility).toBe("breaking");
    const typeChanged = { version: 2, fields: v1().fields.map((f) => f.name === "bytes" ? { ...f, type: "string" as const } : f) };
    const r = analyzeCompatibility(v1(), typeChanged, "ev-usage");
    expect(r.compatibility).toBe("breaking");
    expect(r.changes.find((c) => c.field === "bytes")?.change).toBe("type number -> string");
    const sim = simulateEvolution(docflowModel(), "ev-usage", removed);
    expect(sim.impactedConsumers[0].reason).toContain("breaking");
  });
});

// ---------------------------------------------------------------------------
// Task 19 — idempotency lifecycle
// ---------------------------------------------------------------------------

describe("T19 idempotency lifecycle debugger", () => {
  const req = (key: string, payload: string, at = 100) =>
    ({ key, operation: "charge", payloadHash: payload, at });

  it("suppresses duplicates and replays stored results", () => {
    let s = emptyIdempotencyState();
    const first = dispatch(s, req("k1", "p1"));
    expect(first.outcome).toMatchObject({ response: "executed", sideEffects: 1 });
    s = first.state;
    const dup = dispatch(s, req("k1", "p1"));
    expect(dup.outcome).toMatchObject({ response: "in-flight", sideEffects: 0 });
    s = complete(s, "k1", "order-42", 150);
    const retry = dispatch(s, req("k1", "p1", 160));
    expect(retry.outcome).toMatchObject({ response: "replayed", sideEffects: 0 });
    expect(retry.outcome.reason).toContain("order-42");
  });

  it("the concurrent duplicate simulation produces exactly one side effect", () => {
    const r = simulateConcurrentDuplicate();
    expect(r.sideEffectCount).toBe(1);
    expect(r.events.length).toBe(4);
  });

  it("rejects mismatched payloads under the same key (misuse)", () => {
    let s = emptyIdempotencyState();
    s = dispatch(s, req("k2", "payload-A")).state;
    const misuse = dispatch(s, req("k2", "payload-B"));
    expect(misuse.outcome.response).toBe("rejected");
    expect(misuse.outcome.sideEffects).toBe(0);
    expect(misuse.outcome.reason).toContain("different payload");
  });

  it("a failed operation re-executes on retry (failure committed nothing)", () => {
    let s = emptyIdempotencyState();
    s = dispatch(s, req("k3", "p")).state;
    s = fail(s, "k3");
    expect(s.records["k3"].state).toBe("failed");
    const retry = dispatch(s, req("k3", "p"));
    expect(retry.outcome).toMatchObject({ response: "executed", sideEffects: 1 });
    expect(retry.outcome.reason).toContain("without committing");
  });

  it("keys expire and reuse after expiry executes a fresh operation", () => {
    let s = emptyIdempotencyState();
    s = dispatch(s, req("k4", "p", 0)).state;
    s = complete(s, "k4", "done", 10);
    s = expireAll(s, 60_001);
    expect(s.records["k4"].state).toBe("expired");
    const reuse = dispatch(s, req("k4", "p", 61_000));
    expect(reuse.outcome.response).toBe("expired-then-executed");
    expect(reuse.outcome.sideEffects).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Task 20 — saga state machine verifier
// ---------------------------------------------------------------------------

describe("T20 saga verifier", () => {
  it("the reference saga validates cleanly", () => {
    expect(validateSaga(docflowModel(), docflowDeleteSaga())).toEqual([]);
  });

  it("detects missing compensations, unreachable steps, and ambiguous terminals", () => {
    const broken: SagaDefinition = {
      id: "saga-broken", name: "broken", terminalStates: ["done"],
      steps: [
        { id: "b1", name: "mutate without compensation", actionComponentId: "upload-svc", mutates: true },
        { id: "b2", name: "disconnected step", actionComponentId: "notify", mutates: false },
      ],
    };
    const issues = validateSaga(docflowModel(), broken);
    expect(issues.some((i) => i.kind === "missing-compensation")).toBe(true);
    expect(issues.some((i) => i.kind === "unreachable-step")).toBe(true);
    expect(issues.some((i) => i.kind === "ambiguous-terminal")).toBe(true);
  });

  it("enumerates failure paths with reverse-order compensations", () => {
    const paths = failurePaths(docflowDeleteSaga());
    expect(paths[0]).toMatchObject({ outcome: "completed" });
    const failAtS2 = paths.find((p) => p.failAtStep === "Delete original from document store")!;
    expect(failAtS2.compensations).toEqual(["Restore metadata record"]); // only s1 completed before s2
    expect(failAtS2.outcome).toBe("compensated");
  });

  it("executes successfully and under permanent failure with compensation", () => {
    const ok = executeSaga(docflowDeleteSaga());
    expect(ok.finalState).toBe("completed");
    expect(ok.events.filter((e) => e.action === "forward").length).toBe(4);

    const failed = executeSaga(docflowDeleteSaga(), { failAtStep: "s3", retryBehavior: "always-fails" });
    expect(failed.finalState).toBe("compensated");
    expect(failed.events.filter((e) => e.action === "retry").length).toBe(3); // retryMax on s3
    const compensations = failed.events.filter((e) => e.action === "compensate");
    expect(compensations.map((c) => c.step)).toEqual(["s2", "s1"]); // reverse order
  });

  it("retries can recover and compensation failure forces manual recovery", () => {
    const recovered = executeSaga(docflowDeleteSaga(), { failAtStep: "s3", retryBehavior: "succeeds-after-retries" });
    expect(recovered.finalState).toBe("completed");

    const compFail = executeSaga(docflowDeleteSaga(), { failAtStep: "s3", retryBehavior: "always-fails", compensateFailsAt: "s2" });
    expect(compFail.finalState).toBe("manual-recovery");
    expect(compFail.unresolved).toEqual(["Delete original from document store"]);
  });
});
