/**
 * Lab UI primitives. Accessibility follows the trail convention: every state
 * badge carries label + icon + color — meaning is never communicated by color
 * alone (AGENTS.md rule).
 */

import React from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { Finding, Severity } from "./model";
import { kindOfSource, type EvidenceKind } from "./engines/evidence";

export const Panel: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode }> =
  ({ title, subtitle, children, right }) => (
    <section className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 mb-4" aria-label={title}>
      <header className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </header>
      {children}
    </section>
  );

const SEVERITY_META: Record<Severity, { label: string; icon: React.ReactNode; cls: string }> = {
  critical: { label: "Critical", icon: <XCircle size={14} aria-hidden />, cls: "bg-rose-500/15 text-rose-300 border-rose-500/40" },
  warning: { label: "Warning", icon: <AlertTriangle size={14} aria-hidden />, cls: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
  info: { label: "Info", icon: <Info size={14} aria-hidden />, cls: "bg-sky-500/15 text-sky-300 border-sky-500/40" },
};

export const StateBadge: React.FC<{ severity: Severity }> = ({ severity }) => {
  const meta = SEVERITY_META[severity];
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-semibold ${meta.cls}`}>
      {meta.icon}
      {meta.label}
    </span>
  );
};

export const OkBadge: React.FC = () => (
  <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border-emerald-500/40">
    <CheckCircle2 size={14} aria-hidden />
    Satisfied
  </span>
);

export const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = "", ...props }) => (
  <button
    {...props}
    className={`rounded-md px-3 py-1.5 text-xs font-semibold border border-slate-600 bg-slate-700/60 text-slate-100 hover:bg-slate-600/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${className}`}
  />
);

export const EvidenceChips: React.FC<{ evidence: { ref: string; detail: string }[] }> = ({ evidence }) => (
  <div className="flex flex-wrap gap-1 mt-1">
    {evidence.map((e, i) => (
      <span key={i} className="rounded bg-slate-900/80 border border-slate-600/50 px-1.5 py-0.5 text-[10px] font-mono text-slate-300"
        title={e.detail}>{e.ref}</span>
    ))}
  </div>
);

const KIND_CLS: Record<EvidenceKind, string> = {
  observed: "bg-emerald-500/10 text-emerald-300 border-emerald-500/40",
  simulated: "bg-violet-500/10 text-violet-300 border-violet-500/40",
  inferred: "bg-amber-500/10 text-amber-300 border-amber-500/40",
  "user-authored": "bg-sky-500/10 text-sky-300 border-sky-500/40",
};

/** Evidence-kind chip: label + icon + color (never color alone). */
export const EvidenceKindChip: React.FC<{ kind: EvidenceKind }> = ({ kind }) => (
  <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${KIND_CLS[kind]}`}
    title={`Evidence kind: ${kind}`}>
    <Info size={11} aria-hidden />
    {kind}
  </span>
);

export const FindingsList: React.FC<{ findings: Finding[]; emptyText?: string }> = ({ findings, emptyText = "No findings." }) => (
  <ul className="space-y-2">
    {findings.length === 0 && <li className="text-xs text-slate-400">{emptyText}</li>}
    {findings.map((f) => (
      <li key={f.id} className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <StateBadge severity={f.severity} />
          <EvidenceKindChip kind={kindOfSource(f.source)} />
          <span className="text-xs font-semibold text-slate-100">{f.title}</span>
        </div>
        <p className="text-xs text-slate-300 mt-1 leading-relaxed">{f.detail}</p>
        <EvidenceChips evidence={f.evidence} />
      </li>
    ))}
  </ul>
);

export const Metric: React.FC<{ label: string; value: string | number; hint?: string }> = ({ label, value, hint }) => (
  <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-2.5">
    <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
    <div className="text-lg font-bold text-slate-100">{value}</div>
    {hint && <div className="text-[10px] text-slate-400 mt-0.5">{hint}</div>}
  </div>
);

export const Callout: React.FC<{ kind: "honest" | "warn"; children: React.ReactNode }> = ({ kind, children }) => (
  <div className={`rounded-lg border p-2.5 text-xs leading-relaxed ${kind === "honest"
    ? "border-sky-500/40 bg-sky-500/10 text-sky-200"
    : "border-amber-500/40 bg-amber-500/10 text-amber-200"}`}
    role="note">
    {children}
  </div>
);
