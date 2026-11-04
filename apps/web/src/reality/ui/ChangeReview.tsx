/**
 * Campaign 07 — Tasks 31–35: Change Intelligence & Release Review UI
 *
 * Pre-Flight Change Governance & Release Cockpit:
 * Ingests Git commits, inspects API contract breaking changes, diffs Terraform/K8s
 * infrastructure modifications, and evaluates release readiness policies.
 */

import React, { useState, useMemo } from "react";
import {
  GitPullRequest, CheckCircle2, ShieldCheck, XCircle, HelpCircle,
  FileCode, Check, ShieldAlert, GitCommit
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-white tracking-tight">Change Impact & Release Intelligence</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-purple-500/10 text-purple-400 border border-purple-500/30">
              PRE-FLIGHT GATE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Pre-deployment impact analysis linking Git source changes, OpenAPI contract diffs, and infrastructure plans to architecture release gates.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950/70 flex items-center gap-2">
            <ShieldAlert size={12} className="text-rose-400" />
            <div className="text-left">
              <div className="text-[9px] font-mono uppercase text-slate-500 font-bold">Release Guard</div>
              <div className="text-[11px] font-mono text-rose-300 font-semibold">Strict Enforcement</div>
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950/70 flex items-center gap-2">
            <ShieldCheck size={12} className="text-emerald-400" />
            <div className="text-left">
              <div className="text-[9px] font-mono uppercase text-slate-500 font-bold">Production Safety</div>
              <div className="text-[11px] font-mono text-emerald-300 font-semibold">Non-Mutating</div>
            </div>
          </div>
        </div>
      </div>

      {/* Release Decision Header Banner */}
      <div
        className={`rounded-xl border p-6 space-y-4 shadow-xl backdrop-blur-md ${
          assessment.overallDecision === "BLOCKED"
            ? "border-rose-500/50 bg-gradient-to-r from-rose-950/30 via-slate-900/80 to-slate-900/60"
            : assessment.overallDecision === "REVIEW_REQUIRED"
            ? "border-amber-500/50 bg-gradient-to-r from-amber-950/30 via-slate-900/80 to-slate-900/60"
            : "border-emerald-500/50 bg-gradient-to-r from-emerald-950/30 via-slate-900/80 to-slate-900/60"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <span
              className={`px-3 py-1 rounded-md text-xs font-mono font-black uppercase tracking-wider border shadow-sm ${
                assessment.overallDecision === "BLOCKED"
                  ? "bg-rose-500/25 text-rose-300 border-rose-500/50"
                  : assessment.overallDecision === "REVIEW_REQUIRED"
                  ? "bg-amber-500/25 text-amber-300 border-amber-500/50"
                  : "bg-emerald-500/25 text-emerald-300 border-emerald-500/50"
              }`}
            >
              RELEASE GATE: {assessment.overallDecision}
            </span>
            <span className="text-sm font-bold text-white tracking-wide">
              Target: <span className="text-sky-300">{assessment.targetService}</span> ({assessment.proposedVersion})
            </span>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Evaluated: {assessment.evaluatedAt.slice(11, 19)} UTC
          </span>
        </div>

        <div className="space-y-2 pt-1">
          <span className="text-xs font-bold text-slate-300 font-mono text-[11px] uppercase tracking-wider block">
            Policy Criteria Ledger:
          </span>
          <div className="space-y-1.5">
            {assessment.criteria.map((crit) => (
              <div
                key={crit.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  {crit.status === "PASSED" ? (
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  ) : crit.status === "FAILED" ? (
                    <XCircle size={16} className="text-rose-400 shrink-0" />
                  ) : (
                    <HelpCircle size={16} className="text-amber-400 shrink-0" />
                  )}
                  <span className="font-bold text-slate-200">{crit.name}</span>
                </div>
                <span className="text-slate-400 text-[11px] leading-snug pl-6 sm:pl-0">{crit.rationale}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Git Changes & API Contract Diff Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Source Change (Git Commit) */}
        <div className="rounded-xl border border-slate-800/90 bg-slate-900/60 backdrop-blur-md p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-sky-500/10 border border-sky-500/30">
                <FileCode size={16} className="text-sky-400" />
              </div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Git Commit Diff ({sampleCommit.commitHash})
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-800">
              1 Commit
            </span>
          </div>

          <div className="space-y-3.5 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 font-mono space-y-1">
              <div className="text-slate-200 font-bold flex items-center gap-2">
                <GitCommit size={14} className="text-sky-400 shrink-0" />
                <span>{sampleCommit.message}</span>
              </div>
              <div className="text-slate-500 text-[11px] pl-5">Author: {sampleCommit.author}</div>
            </div>

            <div className="space-y-1.5">
              <span className="text-slate-400 font-bold text-[10px] uppercase font-mono tracking-wider block">
                Changed Files & Mapped Services:
              </span>
              <div className="space-y-1">
                {sampleCommit.changedFiles.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] font-mono"
                  >
                    <span className="text-slate-300 truncate">{f.path}</span>
                    <span className="text-emerald-400 shrink-0 font-bold ml-2">+{f.additions} / -{f.deletions}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 text-slate-400 text-xs border-t border-slate-800/60">
              Affected Architecture Services:{" "}
              <strong className="text-sky-300">{sampleCommit.affectedServices.join(", ")}</strong>
            </div>
          </div>
        </div>

        {/* API Contract Diff */}
        <div className="rounded-xl border border-slate-800/90 bg-slate-900/60 backdrop-blur-md p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-amber-500/10 border border-amber-500/30">
                <GitPullRequest size={16} className="text-amber-400" />
              </div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                OpenAPI Contract Diff
              </h3>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                contractDiff.isBreaking ? "bg-rose-500/20 text-rose-300 border border-rose-500/40" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
              }`}
            >
              {contractDiff.isBreaking ? "Breaking Changes Detected" : "Compatible"}
            </span>
          </div>

          <div className="space-y-3.5 text-xs">
            {contractDiff.breakingChanges.map((b, i) => (
              <div
                key={i}
                className="p-3.5 rounded-xl border border-rose-500/40 bg-gradient-to-r from-rose-950/25 to-slate-950 space-y-1.5"
              >
                <div className="flex items-center justify-between font-bold text-rose-300">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="px-1.5 py-0.5 rounded bg-rose-500/25 text-rose-200 text-[10px]">{b.method}</span>
                    <span className="text-white">{b.path}</span>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                    Breaking
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed">{b.description}</p>
              </div>
            ))}

            <div className="text-slate-400 pt-2 border-t border-slate-800/60">
              Consumers Impacted by Change:{" "}
              <strong className="text-rose-300 font-semibold">{contractDiff.affectedConsumers.join(", ") || "None"}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Human Release Sign-Off (Without production mutation) */}
      <div className="rounded-xl border border-slate-800/90 bg-slate-900/60 backdrop-blur-md p-5 space-y-3.5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-sky-500/10 border border-sky-500/30">
              <ShieldCheck size={16} className="text-sky-400" />
            </div>
            <h3 className="text-sm font-bold text-white tracking-wide">Engineering Release Authorization</h3>
          </div>
          <span className="text-[10px] font-mono text-slate-500 px-2 py-0.5 rounded bg-slate-800 font-bold uppercase">
            AUDIT TRAIL
          </span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Records human engineering approval without executing automated cloud mutations or Kubernetes deployment actions.
        </p>

        {humanApproved ? (
          <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs flex items-center gap-3 font-mono shadow-sm">
            <div className="p-1.5 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">
              <Check size={16} />
            </div>
            <span className="font-medium">Human Authorization Recorded: Approved by Lead Architect at {approvedAt ?? "12:00:00"} UTC</span>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
            <input
              type="text"
              placeholder="Sign-off notes or waiver rationale..."
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              className="flex-1 rounded-lg border border-slate-700/80 bg-slate-950 px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
            />
            <button
              onClick={handleApprove}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs transition-all shadow-md shadow-sky-500/20 shrink-0 active:scale-[0.98]"
            >
              Record Human Sign-off
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
