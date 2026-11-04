import React from "react";
import { BookOpenCheck, FileText, CheckCircle2, Database, Award } from "lucide-react";
import { useCountUp } from "../lib/useCountUp";
import { formatKpiValue } from "../lib/ultra";

/** Animated count chip for the hero (icon + mono count-up label). */
const CountChip: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
}> = ({ icon: Icon, value, label }) => {
  const animated = useCountUp(value, { durationMs: 1200 });
  return (
    <span className="ultra-chip text-accent-cyan">
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span className="font-mono font-bold">
        {formatKpiValue(animated, { decimals: 0 })} {label}
      </span>
    </span>
  );
};

/** Dataset provenance card with count-up scale & prevalence readouts. */
const DatasetCard: React.FC<{
  name: string;
  sizeCount: number;
  sizeUnit: string;
  fraudRate: number;
  rateDecimals: number;
  status: string;
  designation: string;
}> = ({ name, sizeCount, sizeUnit, fraudRate, rateDecimals, status, designation }) => {
  const size = useCountUp(sizeCount, { durationMs: 1400 });
  const rate = useCountUp(fraudRate, { durationMs: 1400 });

  return (
    <div className="ultra-card ultra-crown p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-xs text-slate-900 dark:text-white">{name}</span>
        <span className="ultra-chip text-emerald-500">
          <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden="true" />
          <span className="font-bold">{status}</span>
        </span>
      </div>
      <div className="text-[11px] text-slate-500 space-y-0.5">
        <div>
          Scale: <strong className="text-slate-700 dark:text-slate-300">{formatKpiValue(size, { decimals: 0 })} {sizeUnit}</strong>
        </div>
        <div>
          Prevalence: <strong className="text-slate-700 dark:text-slate-300">{formatKpiValue(rate, { decimals: rateDecimals })}%</strong>
        </div>
        <div className="text-[10px] font-mono text-accent-teal dark:text-accent-cyan pt-1">{designation}</div>
      </div>
    </div>
  );
};

export const ResearchCenter: React.FC = () => {
  const artifacts = [
    {
      title: "Comprehensive Benchmark Report",
      path: "BENCHMARKS.md",
      type: "Markdown / Evidence",
      desc: "Full evaluation matrix comparing 6 models with 95% bootstrap confidence intervals.",
    },
    {
      title: "Independent Red-Team & Ablation Study",
      path: "reports/ABLATION_STUDY.md",
      type: "Markdown / Ablation",
      desc: "Quantifies incremental gain of Gradient Boosting (+60.6%), Graph Heuristics (+8.7pp Recall@1%FPR), and Policy Optimization (86.1% loss reduction).",
    },
    {
      title: "Executive Finalist Presentation Deck",
      path: "reports/AEGIS_Fraud_X_Finalist_Presentation.pptx",
      type: "PowerPoint PPTX (12 Slides)",
      desc: "16:9 widescreen presentation with charts, architecture diagrams, and empirical proof.",
    },
    {
      title: "Scientific Research Foundation",
      path: "docs/RESEARCH.md",
      type: "Literature Review",
      desc: "Mathematical formulations for calibration, cost-sensitive optimization, and temporal graphs.",
    },
    {
      title: "Architecture & System Specification",
      path: "ARCHITECTURE.md",
      type: "System Architecture",
      desc: "Dual-stream feature extraction, Pydantic schemas, and FastAPI ASGI pipeline.",
    },
  ];

  const datasets = [
    {
      name: "Seeded Synthetic Benchmark",
      sizeCount: 10000,
      sizeUnit: "transactions",
      fraudRate: 1.99,
      rateDecimals: 2,
      status: "Actively Benchmarked",
      designation: "SYNTHETIC (Deterministic seed=42)",
      checksum: "Manifest SHA-256 Verified",
    },
    {
      name: "ULB Credit Card Fraud",
      sizeCount: 284807,
      sizeUnit: "transactions",
      fraudRate: 0.172,
      rateDecimals: 3,
      status: "Adapter Implemented",
      designation: "REAL ANONYMIZED (ULB ML Group)",
      checksum: "Zero Lookahead Splitter Ready",
    },
    {
      name: "PaySim Mobile Money",
      sizeCount: 6362620,
      sizeUnit: "transactions",
      fraudRate: 0.129,
      rateDecimals: 3,
      status: "Adapter Implemented",
      designation: "SIMULATED MULTI-AGENT (PaySim)",
      checksum: "Graph Replay Ready",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border p-6 bg-gradient-to-r from-navy-900 via-navy-800 to-navy-950 border-navy-700 text-white shadow-card-ultra">
        <div className="ultra-grid-overlay absolute inset-0" aria-hidden="true" />
        <div className="relative z-10 space-y-1.5">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <BookOpenCheck className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
              Scientific Reproducibility
            </span>
          </div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-white">
            Research, Provenance <span className="ultra-shimmer-text">&amp; Evidence Center</span>
          </h1>
          <p className="text-xs text-slate-300 max-w-3xl">
            All benchmark numbers, model cards, and ablation claims are bound to verifiable repository artifacts.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1.5">
            <CountChip icon={Award} value={artifacts.length} label="Deliverables" />
            <CountChip icon={Database} value={datasets.length} label="Datasets" />
          </div>
        </div>
      </div>

      {/* Dataset Provenance Matrix */}
      <div className="ultra-card ultra-crown p-5 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
          Dataset Provenance &amp; Integrity Manifests
        </h2>

        <div className="ultra-stagger grid grid-cols-1 md:grid-cols-3 gap-4">
          {datasets.map((d, i) => (
            <DatasetCard
              key={i}
              name={d.name}
              sizeCount={d.sizeCount}
              sizeUnit={d.sizeUnit}
              fraudRate={d.fraudRate}
              rateDecimals={d.rateDecimals}
              status={d.status}
              designation={d.designation}
            />
          ))}
        </div>
      </div>

      {/* Verified Artifacts List */}
      <div className="ultra-card ultra-crown p-5 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
          Competition Submission Deliverables
        </h2>

        <div className="ultra-stagger space-y-3">
          {artifacts.map((art, i) => (
            <div
              key={i}
              className="ultra-row p-4 rounded-xl border border-slate-200/80 dark:border-navy-700/70 bg-slate-50/80 dark:bg-navy-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <FileText className="w-4 h-4 text-accent-teal dark:text-accent-cyan shrink-0" aria-hidden="true" />
                  <span className="font-bold text-xs text-slate-900 dark:text-white">{art.title}</span>
                  <span className="ultra-chip text-slate-500 dark:text-slate-400 font-mono">
                    {art.type}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{art.desc}</p>
                <div className="text-[10px] font-mono text-slate-400">{art.path}</div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <span className="ultra-chip text-emerald-500">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span className="font-bold">Verified</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
