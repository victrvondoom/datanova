/**
 * Multi-agent collaboration benchmark — runs every named workflow end-to-end
 * against its synthetic scenario and MEASURES: completion rate, task success,
 * handoff delivery, parallel efficiency, evidence completeness, verifier
 * disagreement, approval escalation, and duplicate external effects. Results
 * are produced by this code path (vitest runs it in
 * src/lab/__tests__/c07-agents.test.ts); docs/WORKFLOW_BENCHMARK_RESULTS.md
 * records the observed numbers. Nothing here is estimated.
 */

import { createRun, resolveApproval, runToCompletion } from "./engine";
import { DATASETS, datasetFor } from "./datasets";
import { WORKFLOWS } from "./workflows";
import type { ExecutionMode, RunState } from "./types";

export interface BenchResult {
  workflowId: string;
  workflowName: string;
  status: RunState["status"];
  tasks: number;
  completed: number;
  failed: number;
  blocked: number;
  skipped: number;
  waves: number;
  agentsExecuted: number;
  handoffs: number;
  evidence: number;
  findings: number;
  verifierDisagreements: number;
  approvalEscalations: number;
  externalActions: number;
  duplicateExternalEffects: number;
  parallelEfficiency: number; // tasks per wave (higher = more parallelism used)
  evidenceCompleteness: number; // fraction of agent tasks with ≥1 evidence record
}

const completeWithApprovals = (run: RunState): RunState => {
  let r = run;
  let guard = 0;
  while (r.status === "paused-approval" && guard < 20) {
    const pending = r.approvals.find((a) => a.status === "requested");
    if (!pending) break;
    r = resolveApproval(r, pending.id, "approved", "benchmark: approve");
    guard += 1;
    r = runToCompletion(r, datasetFor(r.workflowId));
  }
  return r;
};

export const runBenchmark = (mode: ExecutionMode = "simulation"): { results: BenchResult[]; summary: Record<string, number> } => {
  const results: BenchResult[] = [];
  for (const def of WORKFLOWS) {
    const dataset = datasetFor(def.id);
    let run = createRun(def, dataset, { tenantId: dataset.tenantId, mode, runId: `bench-${def.id}` }).run;
    if (!run) continue;
    run = runToCompletion(run, dataset, 300);
    if (run.status === "paused-approval") run = completeWithApprovals(run);
    const agentTasks = run.tasks.filter((t) => t.agentId);
    const evidenceNodes = new Set(run.evidence.map((e) => e.nodeId));
    const verifierArtifacts = run.artifacts.filter((a) => a.agentId?.includes("verifier") || a.agentId?.includes("auditor") || a.agentId?.includes("wf07-independent"));
    const disagreements = verifierArtifacts.reduce((s, a) => s + (((a.payload.disagreements as unknown[]) ?? []).length), 0);
    const results0: BenchResult = {
      workflowId: def.id,
      workflowName: def.name,
      status: run.status,
      tasks: run.tasks.length,
      completed: run.tasks.filter((t) => t.status === "completed").length,
      failed: run.tasks.filter((t) => t.status === "failed").length,
      blocked: run.tasks.filter((t) => t.status === "blocked").length,
      skipped: run.tasks.filter((t) => t.status === "skipped").length,
      waves: run.wave,
      agentsExecuted: run.tasks.filter((t) => t.agentId && t.status === "completed").length,
      handoffs: run.handoffs.length,
      evidence: run.evidence.length,
      findings: run.findings.length,
      verifierDisagreements: disagreements,
      approvalEscalations: run.approvals.length,
      externalActions: run.externalActions.length,
      duplicateExternalEffects: run.events.filter((e) => e.type === "action.reconciled").length,
      parallelEfficiency: run.wave > 0 ? Number((run.tasks.filter((t) => t.status === "completed").length / run.wave).toFixed(2)) : 0,
      evidenceCompleteness: agentTasks.length > 0
        ? Number((agentTasks.filter((t) => evidenceNodes.has(t.nodeId)).length / agentTasks.length).toFixed(2))
        : 1,
    };
    results.push(results0);
    // deterministic: rerun and assert identical key metrics
    const ds2 = datasetFor(def.id);
    let run2 = createRun(def, ds2, { tenantId: ds2.tenantId, mode, runId: `bench-${def.id}` }).run!;
    run2 = runToCompletion(run2, ds2, 300);
    if (run2.status === "paused-approval") run2 = completeWithApprovals(run2);
    if (JSON.stringify({ c: run2.tasks.map((t) => [t.nodeId, t.status]), e: run2.events.length, a: run2.artifacts.length })
      !== JSON.stringify({ c: run.tasks.map((t) => [t.nodeId, t.status]), e: run.events.length, a: run.artifacts.length })) {
      throw new Error(`nondeterministic execution detected in ${def.id}`);
    }
  }
  const total = results.length || 1;
  const summary = {
    workflows: results.length,
    completionRate: Number((results.filter((r) => r.status === "completed").length / total).toFixed(2)),
    taskSuccessRate: Number((results.reduce((s, r) => s + r.completed, 0) / results.reduce((s, r) => s + r.tasks, 0)).toFixed(3)),
    totalHandoffs: results.reduce((s, r) => s + r.handoffs, 0),
    totalEvidence: results.reduce((s, r) => s + r.evidence, 0),
    totalFindings: results.reduce((s, r) => s + r.findings, 0),
    verifierDisagreements: results.reduce((s, r) => s + r.verifierDisagreements, 0),
    approvalEscalations: results.reduce((s, r) => s + r.approvalEscalations, 0),
    duplicateExternalEffects: results.reduce((s, r) => s + r.duplicateExternalEffects, 0),
    avgWaves: Number((results.reduce((s, r) => s + r.waves, 0) / total).toFixed(1)),
    avgEvidenceCompleteness: Number((results.reduce((s, r) => s + r.evidenceCompleteness, 0) / total).toFixed(2)),
  };
  return { results, summary };
};

/** Failure-recovery benchmark scenario: force one agent to fail and measure. */
export const benchmarkFailureRecovery = (workflowId = "wf-gpu-billing-audit"): {
  failedNode: string; failedTaskStatus: string; blockedCount: number; status: RunState["status"];
  fabricatedSuccess: boolean; attempts: number;
} => {
  const def = WORKFLOWS.find((w) => w.id === workflowId)!;
  const dataset = datasetFor(def.id);
  // sabotage: remove the lifecycle field so the GPU Lifecycle Auditor must fail
  const broken = { ...dataset, fields: { ...dataset.fields, lifecycle: undefined } };
  const run = createRun(def, broken, { tenantId: dataset.tenantId, mode: "simulation", runId: `fail-${workflowId}` }).run!;
  const finished = runToCompletion(run, broken, 300);
  const failed = finished.tasks.find((t) => t.status === "failed");
  return {
    failedNode: failed?.nodeId ?? "none",
    failedTaskStatus: failed?.status ?? "none",
    blockedCount: finished.tasks.filter((t) => t.status === "blocked").length,
    status: finished.status,
    fabricatedSuccess: finished.tasks.some((t) => t.status === "completed" && t.dependencies.includes(failed?.nodeId ?? "__")),
    attempts: failed?.attempts ?? 0,
  };
};

export const ALL_WORKFLOW_IDS = WORKFLOWS.map((w) => w.id);
export { DATASETS };
