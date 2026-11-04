/**
 * Campaign 07 — Tasks 31–35: Change Intelligence & Release Review UI
 *
 * Ingests Git commits, inspects API contract breaking changes, diffs Terraform/K8s
 * infrastructure modifications, and evaluates release readiness policies.
 */

import React, { useState, useMemo } from "react";
import {
  GitPullRequest, CheckCircle2, ShieldCheck, XCircle, HelpCircle,
  FileCode, Check
} from "lucide-react";
import { ChangeIntelligenceEngine, type ReleaseReadinessAssessment } from "../changes";

interface ChangeReviewProps {
  driftCount: number;
}

export const ChangeReview: React.FC<ChangeReviewProps> = ({ driftCount }) => {
  const [selectedService] = useState("Order Service");
  const [humanApproved, setHumanApproved] = useState(false);
  const [approvedAt, setApprovedAt] = useState<string | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");

  const changeEngine = useMemo(() => new ChangeIntelligenceEngine(), []);

  // Sample Git commit
  const sampleCommit = useMemo(() => {
    return changeEngine.analyzeGitCommit(
      {
        hash: "a4f89d34",
        author: "DevOps Engineer <devops@datanova.io>",
        message: "feat(order): add direct pricing lookup to order service",
        files: [
          "services/order/src/pricing.ts",
          "services/order/src/handler.ts",
          "k8s/order-deployment.yaml",
        ],
      },
      {
        "Order Service": ["services/order/"],
        "Pricing Service": ["services/pricing/"],
      }
    );
  }, [changeEngine]);

  // Sample OpenAPI contract diff
  const contractDiff = useMemo(() => {
    return changeEngine.diffApiContracts(
      "Order Service",
      {
        openapi: "3.0.0",
        paths: {
          "/orders": { post: { summary: "Create order" } },
        },
      },
      {
        openapi: "3.1.0",
        paths: {
          "/orders": {
            post: {
              summary: "Create order",
              parameters: [{ name: "tenantId", in: "header", required: true }],
            },
          },
        },
      },
      ["API Gateway", "Checkout Webapp"]
    );
  }, [changeEngine]);

  // Evaluate release readiness
  const assessment: ReleaseReadinessAssessment = useMemo(() => {
    return changeEngine.evaluateReleaseGate(selectedService, "v2.1.0", {
      contractDiff,
      activeDriftCount: driftCount,
      sloHealth: "healthy",
      unresolvedIncidentCount: 0,
    });
  }, [changeEngine, selectedService, contractDiff, driftCount]);

  const handleApprove = () => {
    setHumanApproved(true);
    setApprovedAt(new Date().toISOString().slice(11, 19));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white">Change Impact & Release Intelligence</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Pre-deployment impact analysis linking Git source changes, OpenAPI contract diffs, and infrastructure plans to architecture release gates.
        </p>
      </div>

      {/* Release Decision Header Banner */}
      <div
        className={`rounded-xl border p-5 space-y-3 ${
          assessment.overallDecision === "BLOCKED"
            ? "border-rose-500/40 bg-rose-950/20"
            : assessment.overallDecision === "REVIEW_REQUIRED"
            ? "border-amber-500/40 bg-amber-950/20"
            : "border-emerald-500/40 bg-emerald-950/20"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold uppercase border ${
                assessment.overallDecision === "BLOCKED"
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                  : assessment.overallDecision === "REVIEW_REQUIRED"
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
              }`}
            >
              RELEASE GATE: {assessment.overallDecision}
            </span>
            <span className="text-xs font-bold text-white">Target: {assessment.targetService} ({assessment.proposedVersion})</span>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Evaluated: {assessment.evaluatedAt.slice(11, 19)} UTC
          </span>
        </div>

        <div className="space-y-1.5 pt-1">
          <span className="text-xs font-semibold text-slate-300">Policy Criteria Ledger:</span>
          {assessment.criteria.map((crit) => (
            <div key={crit.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-800/60">
              <div className="flex items-center gap-2">
                {crit.status === "PASSED" ? (
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                ) : crit.status === "FAILED" ? (
                  <XCircle size={14} className="text-rose-400 shrink-0" />
                ) : (
                  <HelpCircle size={14} className="text-amber-400 shrink-0" />
                )}
                <span className="font-medium text-slate-200">{crit.name}</span>
              </div>
              <span className="text-slate-400 text-[11px]">{crit.rationale}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Git Changes & API Contract Diff Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Source Change (Git Commit) */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileCode size={16} className="text-sky-400" />
              <span>Git Commit Diff ({sampleCommit.commitHash})</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">1 Commit</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono">
              <div className="text-slate-300 font-semibold">{sampleCommit.message}</div>
              <div className="text-slate-500 text-[11px] mt-1">Author: {sampleCommit.author}</div>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 font-semibold text-[11px]">Changed Files & Mapped Services:</span>
              {sampleCommit.changedFiles.map((f, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded bg-slate-950/60 border border-slate-800 text-[11px] font-mono">
                  <span className="text-slate-300 truncate">{f.path}</span>
                  <span className="text-emerald-400 shrink-0">+{f.additions} / -{f.deletions}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 text-slate-400 text-xs">
              Affected Architecture Services:{" "}
              <strong className="text-sky-300">{sampleCommit.affectedServices.join(", ")}</strong>
            </div>
          </div>
        </div>

        {/* API Contract Diff */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <GitPullRequest size={16} className="text-amber-400" />
              <span>OpenAPI Contract Diff</span>
            </h3>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${contractDiff.isBreaking ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300"}`}>
              {contractDiff.isBreaking ? "Breaking Changes Detected" : "Compatible"}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {contractDiff.breakingChanges.map((b, i) => (
              <div key={i} className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 space-y-1">
                <div className="flex items-center justify-between font-bold text-rose-300">
                  <span className="font-mono">{b.method} {b.path}</span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-rose-500/20">Breaking</span>
                </div>
                <p className="text-rose-200">{b.description}</p>
              </div>
            ))}

            <div className="text-slate-400 pt-1">
              Consumers Impacted by Change:{" "}
              <strong className="text-rose-300 font-semibold">{contractDiff.affectedConsumers.join(", ") || "None"}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Human Release Sign-Off (Without production mutation) */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <ShieldCheck size={16} className="text-sky-400" />
          <span>Engineering Release Authorization</span>
        </h3>
        <p className="text-xs text-slate-400">
          Records human engineering approval without executing automated cloud mutations or Kubernetes deployment actions.
        </p>

        {humanApproved ? (
          <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs flex items-center gap-2 font-mono">
            <Check size={14} className="text-emerald-400" />
            <span>Human Authorization Recorded: Approved by Lead Architect at {approvedAt ?? "12:00:00"} UTC</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 pt-1">
            <input
              type="text"
              placeholder="Sign-off notes or waiver rationale..."
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            />
            <button
              onClick={handleApprove}
              className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-colors shadow-sm"
            >
              Record Human Sign-off
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
