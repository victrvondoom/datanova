/**
 * DataNova Campaign 08 — Evidence & Review: 6.A Findings Ledger
 *
 * Centralized registry of all findings across architecture, runtime drift,
 * security boundaries, latency bottlenecks, and release readiness.
 * Styled in luxury creamy white and creamy black aesthetic with cursive typography.
 */

import React, { useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import type { FindingItem } from "../types";

interface FindingsSubViewProps {
  onNavigateWorkspace: (subview: string) => void;
  darkMode?: boolean;
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
  darkMode = true,
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
    <div className={`space-y-6 transition-colors ${darkMode ? "text-[#f4f4f5]" : "text-[#111113]"}`}>
      {/* Header and Filter */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border backdrop-blur-md shadow-lg ${
        darkMode ? "border-[#27272a] bg-[#121214]" : "border-[#e4e2dd] bg-[#ffffff]"
      }`}>
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold tracking-tight">Active Findings Ledger</h2>
            <span className="text-[10px] font-mono tracking-widest uppercase font-semibold text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              Reconciled Intelligence
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25">
              {SAMPLE_FINDINGS.length} DISCOVERIES
            </span>
          </div>
          <p className={`text-xs mt-1 max-w-2xl leading-relaxed ${darkMode ? "text-[#a1a1aa]" : "text-[#52525b]"}`}>
            All findings discovered by DataNova specialist engines and telemetry reconciliation, linked to affected components and evidence.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 p-1 rounded-xl border text-[10px] font-mono ${
            darkMode ? "bg-[#09090b] border-[#27272a]" : "bg-[#f4f4f5] border-[#e4e4e7]"
          }`}>
            {["all", "runtime", "reliability", "security", "change"].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg capitalize transition-all font-semibold ${
                  selectedCategory === cat
                    ? darkMode
                      ? "bg-[#18181b] text-amber-400 border border-amber-500/30 shadow-sm font-bold"
                      : "bg-white text-zinc-900 border border-zinc-200 shadow-sm font-bold"
                    : darkMode
                    ? "text-zinc-400 hover:text-zinc-200"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-2.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search findings, components..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className={`rounded-xl border pl-8 pr-3 py-1.5 text-xs placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 transition-all ${
                darkMode
                  ? "border-[#27272a] bg-[#09090b] text-[#f4f4f5]"
                  : "border-[#e4e4e7] bg-[#ffffff] text-[#111113]"
              }`}
            />
          </div>
        </div>
      </div>

      {/* Findings Cards List */}
      <div className="space-y-4">
        {filtered.map((f) => (
          <div
            key={f.id}
            className={`p-5 rounded-2xl border text-xs space-y-3 transition-all shadow-md ${
              f.severity === "critical"
                ? darkMode
                  ? "border-rose-500/30 bg-[#141417]"
                  : "border-rose-200 bg-[#fffdfd]"
                : darkMode
                ? "border-amber-500/30 bg-[#141417]"
                : "border-amber-200 bg-[#fffffb]"
            }`}
          >
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 ${
              darkMode ? "border-[#27272a]" : "border-[#e4e2dd]"
            }`}>
              <div className="flex items-center gap-2.5">
                <span
                  className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                    f.severity === "critical"
                      ? "bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                      : "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                  }`}
                >
                  {f.severity}
                </span>
                <h3 className="font-bold text-sm tracking-tight">{f.title}</h3>
              </div>
              <span className={`font-mono text-xs font-semibold px-2 py-0.5 rounded border ${
                darkMode
                  ? "bg-[#09090b] border-[#27272a] text-amber-400"
                  : "bg-zinc-100 border-zinc-200 text-zinc-800"
              }`}>
                Component: {f.affectedComponent}
              </span>
            </div>

            <p className={`leading-relaxed text-xs ${darkMode ? "text-[#a1a1aa]" : "text-[#52525b]"}`}>{f.plainSummary}</p>

            <div className={`p-3 rounded-xl border space-y-1 ${
              darkMode ? "bg-[#09090b] border-[#27272a]" : "bg-[#fbfaf8] border-[#e4e2dd]"
            }`}>
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-500 font-bold block">
                Why this matters:
              </span>
              <p className={`text-[11px] leading-relaxed ${darkMode ? "text-[#a1a1aa]" : "text-[#52525b]"}`}>{f.whyItMatters}</p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className={`flex items-center gap-2 font-mono text-[11px] ${
                darkMode ? "text-zinc-400" : "text-zinc-600"
              }`}>
                <span>Technical:</span>
                <span className={`font-semibold ${darkMode ? "text-zinc-200" : "text-zinc-800"}`}>{f.technicalTerm}</span>
                <span>&bull;</span>
                <span className="text-amber-500 font-semibold">Proof: {f.evidenceRef}</span>
              </div>

              <button
                onClick={() => {
                  if (f.category === "runtime") onNavigateWorkspace("investigate");
                  else if (f.category === "reliability") onNavigateWorkspace("analyze");
                  else onNavigateWorkspace("improve");
                }}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 self-start sm:self-auto active:scale-95 border ${
                  darkMode
                    ? "bg-[#18181b] hover:bg-[#27272a] text-zinc-100 border-[#27272a] hover:border-amber-500/40 shadow-sm"
                    : "bg-zinc-900 hover:bg-zinc-800 text-white border-zinc-900 shadow-sm"
                }`}
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
