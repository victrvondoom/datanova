/**
 * DataNova Campaign 08 — Evidence & Review: 6.A Findings Ledger
 *
 * Centralized registry of all findings across architecture, runtime drift,
 * security boundaries, latency bottlenecks, and release readiness.
 */

import React, { useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import type { FindingItem } from "../types";

interface FindingsSubViewProps {
  onNavigateWorkspace: (subview: string) => void;
}

const SAMPLE_FINDINGS: FindingItem[] = [
  {
    id: "find-01",
    title: "Undocumented Synchronous Call: Pricing Service",
    plainSummary:
      "Order Service directly calls Pricing Service synchronously, bypassing the declared RabbitMQ queue.",
    technicalTerm: "Undocumented Architectural Ingress Drift",
    severity: "critical",
    affectedComponent: "Pricing Service",
    evidenceRef: "trace-tr-001 (span: calculateDiscount)",
    whyItMatters:
      "A failure or slowdown in Pricing Service directly cascades to checkout clients, causing lost customer transactions.",
    recommendedAction: "Investigate in Workbench → Investigate, or accept drift as intended.",
    category: "runtime",
  },
  {
    id: "find-02",
    title: "Primary Latency Bottleneck: Pricing Calculation",
    plainSummary:
      "57% of end-to-end checkout request time is spent on synchronous database pricing table scans.",
    technicalTerm: "Critical-Path Latency Concentration",
    severity: "warning",
    affectedComponent: "Pricing Service",
    evidenceRef: "otel-span-stream-p95 (105ms self-duration)",
    whyItMatters:
      "Single-thread queries saturate PostgreSQL connections under peak Black Friday shopping volume.",
    recommendedAction: "Review Critical-Path Latency in Workbench → Analyze.",
    category: "reliability",
  },
  {
    id: "find-03",
    title: "Unencrypted Link Across Security Boundary",
    plainSummary:
      "Traffic between the public API Gateway and internal processing services is transmitted in plaintext without TLS.",
    technicalTerm: "Trust Boundary Traversal Violation",
    severity: "warning",
    affectedComponent: "API Gateway → Order Service",
    evidenceRef: "k8s-service-manifest-order.yaml",
    whyItMatters:
      "Internal network traffic could be intercepted or snooped if host perimeter security is compromised.",
    recommendedAction: "Enforce mutual TLS (mTLS) in Workbench → Improve.",
    category: "security",
  },
  {
    id: "find-04",
    title: "Release Gate Blocked: Breaking API Contract Diff",
    plainSummary:
      "Commit a4f89d34 adds a required header parameter (tenantId) that breaks existing mobile and web checkout clients.",
    technicalTerm: "OpenAPI Non-Backward-Compatible Contract Modification",
    severity: "critical",
    affectedComponent: "Order Service v2.1.0",
    evidenceRef: "git-commit-a4f89d34 / OpenAPI 3.1.0 diff",
    whyItMatters:
      "Deploying this update directly will cause checkout failures for all un-updated client applications.",
    recommendedAction: "Inspect API Contract Diff and record human sign-off in Workbench → Improve.",
    category: "change",
  },
];

export const FindingsSubView: React.FC<FindingsSubViewProps> = ({
  onNavigateWorkspace,
}) => {
  const [filterQuery, setFilterQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filtered = SAMPLE_FINDINGS.filter((f) => {
    const matchesQuery =
      f.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
      f.affectedComponent.toLowerCase().includes(filterQuery.toLowerCase()) ||
      f.plainSummary.toLowerCase().includes(filterQuery.toLowerCase());
    const matchesCat = selectedCategory === "all" || f.category === selectedCategory;
    return matchesQuery && matchesCat;
  });

  return (
    <div className="space-y-6">
      {/* Header and Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white tracking-tight">Active Findings Ledger</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-rose-500/10 text-rose-300 border border-rose-500/30">
              {SAMPLE_FINDINGS.length} DISCOVERIES
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            All findings discovered by DataNova specialist engines and telemetry reconciliation, linked to affected components and evidence.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[10px] font-mono">
            {["all", "runtime", "reliability", "security", "change"].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2 py-0.5 rounded capitalize ${
                  selectedCategory === cat
                    ? "bg-sky-500 text-white font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search findings, components..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>
      </div>

      {/* Findings Cards List */}
      <div className="space-y-4">
        {filtered.map((f) => (
          <div
            key={f.id}
            className={`p-5 rounded-2xl border text-xs space-y-3 transition-all ${
              f.severity === "critical"
                ? "border-rose-500/40 bg-gradient-to-r from-rose-950/20 via-slate-900/80 to-slate-900/60 shadow-lg shadow-rose-950/10"
                : "border-amber-500/40 bg-gradient-to-r from-amber-950/20 via-slate-900/80 to-slate-900/60 shadow-lg shadow-amber-950/10"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2.5">
                <span
                  className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                    f.severity === "critical"
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  }`}
                >
                  {f.severity}
                </span>
                <h3 className="font-bold text-white text-sm tracking-tight">{f.title}</h3>
              </div>
              <span className="font-mono text-slate-300 text-xs font-semibold px-2 py-0.5 rounded bg-slate-950/80 border border-slate-800">
                Component: {f.affectedComponent}
              </span>
            </div>

            <p className="text-slate-200 leading-relaxed text-xs">{f.plainSummary}</p>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold block">
                Why this matters:
              </span>
              <p className="text-slate-300 text-[11px] leading-relaxed">{f.whyItMatters}</p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
                <span>Technical:</span>
                <span className="text-slate-200 font-semibold">{f.technicalTerm}</span>
                <span>&bull;</span>
                <span className="text-sky-400">Proof: {f.evidenceRef}</span>
              </div>

              <button
                onClick={() => {
                  if (f.category === "runtime") onNavigateWorkspace("investigate");
                  else if (f.category === "reliability") onNavigateWorkspace("analyze");
                  else onNavigateWorkspace("improve");
                }}
                className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-colors shadow-sm flex items-center gap-1.5 self-start sm:self-auto"
              >
                <span>Take Action in Workspace</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
