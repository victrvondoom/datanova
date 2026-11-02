/** Small shared presentational parts for the Studio. */
import React, { useId, useState } from "react";
import { getTopic } from "../trail/content";
import { topicHref } from "../trail/router";
import { Severity, SEVERITY_LABEL } from "./validation";

const SEV_STYLE: Record<Severity, { cls: string; icon: string }> = {
  critical: { cls: "bg-rose-500/20 text-rose-300 border-rose-500/60", icon: "⛔" },
  high: { cls: "bg-orange-500/15 text-orange-300 border-orange-500/50", icon: "▲" },
  medium: { cls: "bg-amber-500/15 text-amber-300 border-amber-500/40", icon: "◆" },
  info: { cls: "bg-sky-500/10 text-sky-300 border-sky-500/30", icon: "ⓘ" },
};

export const SeverityBadge: React.FC<{ severity: Severity }> = ({ severity }) => (
  <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-bold ${SEV_STYLE[severity].cls}`}>
    <span aria-hidden="true">{SEV_STYLE[severity].icon}</span>
    {SEVERITY_LABEL[severity]}
  </span>
);

export const TopicLinks: React.FC<{ topics: number[] }> = ({ topics }) =>
  topics.length === 0 ? <span className="text-slate-500">—</span> : (
    <span className="inline-flex flex-wrap gap-1.5">
      {topics.map((t) => (
        <a key={t} href={topicHref(t)} className="rounded border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-xs text-sky-300 hover:bg-sky-500/20 focus-visible:ring-2 focus-visible:ring-sky-400">
          Topic {String(t).padStart(2, "0")} · {getTopic(t)?.title.replace(/\s*\(.*\)/, "") ?? "?"}
        </a>
      ))}
    </span>
  );

export const Panel: React.FC<{ title: string; hint?: string; children: React.ReactNode; className?: string }> = ({ title, hint, children, className = "" }) => (
  <section className={`rounded-xl border border-slate-600/40 bg-slate-800/60 p-4 ${className}`}>
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="text-sm font-bold uppercase tracking-wider text-sky-300">{title}</h3>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
    {children}
  </section>
);

const inputCls = "w-full rounded-md border border-slate-500/50 bg-slate-900/70 px-2 py-1.5 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400";

export const Field: React.FC<{ label: string; help?: string; children: (id: string) => React.ReactNode }> = ({ label, help, children }) => {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-semibold text-slate-300">{label}</label>
      {children(id)}
      {help && <p className="text-[11px] text-slate-500">{help}</p>}
    </div>
  );
};

export const TextField: React.FC<{ label: string; value: string; onChange: (v: string) => void; help?: string; multiline?: boolean; placeholder?: string }> = ({ label, value, onChange, help, multiline, placeholder }) => (
  <Field label={label} help={help}>
    {(id) => multiline
      ? <textarea id={id} rows={3} className={inputCls} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      : <input id={id} className={inputCls} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />}
  </Field>
);

/** number input that commits on blur / Enter so half-typed values are never clamped mid-edit */
export const NumField: React.FC<{ label: string; value: number; onCommit: (v: number) => void; help?: string; min?: number; step?: number }> = ({ label, value, onCommit, help, min, step }) => {
  const [text, setText] = useState(String(value));
  const [seen, setSeen] = useState(value);
  // adopt external changes (e.g. "Sync from architecture") without an effect
  if (seen !== value) { setSeen(value); setText(String(value)); }
  const commit = () => { const n = parseFloat(text); if (Number.isFinite(n)) onCommit(n); else setText(String(value)); };
  return (
    <Field label={label} help={help}>
      {(id) => <input id={id} type="number" inputMode="decimal" min={min} step={step} className={inputCls} value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); }} />}
    </Field>
  );
};

export const SelectField: React.FC<{ label: string; value: string; options: Array<string | { value: string; label: string }>; onChange: (v: string) => void; help?: string }> = ({ label, value, options, onChange, help }) => (
  <Field label={label} help={help}>
    {(id) => (
      <select id={id} className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => {
          const v = typeof o === "string" ? o : o.value;
          return <option key={v} value={v}>{typeof o === "string" ? o.replace(/_/g, " ") : o.label}</option>;
        })}
      </select>
    )}
  </Field>
);

export const CheckField: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void; help?: string }> = ({ label, checked, onChange, help }) => {
  const id = useId();
  return (
    <div className="space-y-0.5">
      <label htmlFor={id} className="flex items-center gap-2 text-sm text-slate-200">
        <input id={id} type="checkbox" className="h-4 w-4 accent-sky-400" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
      {help && <p className="pl-6 text-[11px] text-slate-500">{help}</p>}
    </div>
  );
};

export const Status: React.FC<{ kind: "ok" | "error" | "info"; children: React.ReactNode }> = ({ kind, children }) => (
  <div role={kind === "error" ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${kind === "ok" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : kind === "error" ? "border-rose-500/50 bg-rose-500/10 text-rose-200" : "border-sky-500/40 bg-sky-500/10 text-sky-200"}`}>
    {children}
  </div>
);

import { StateBadge } from "../trail/ui";
import { Outcome, OUTCOME_LABEL } from "./failures";
import { LoadStatus } from "./capacity";

export const OutcomeBadge: React.FC<{ outcome: Outcome }> = ({ outcome }) => {
  const state = outcome === "handled" ? "healthy" : outcome === "degraded" ? "degraded" : outcome === "failed" ? "failed" : outcome === "data_risk" ? "blocked" : "idle";
  return <StateBadge state={state} label={OUTCOME_LABEL[outcome]} />;
};

export const LoadBadge: React.FC<{ status: LoadStatus }> = ({ status }) => {
  const m = { comfortable: ["healthy", "Comfortable"], tight: ["degraded", "Tight"], overloaded: ["failed", "Overloaded"], no_capacity: ["blocked", "No capacity"] } as const;
  return <StateBadge state={m[status][0]} label={m[status][1]} />;
};

export const Meter: React.FC<{ label: string; ratio: number; detail?: string }> = ({ label, ratio, detail }) => {
  const pct = Number.isFinite(ratio) ? Math.round(ratio * 100) : null;
  const width = pct === null ? 100 : Math.min(100, pct);
  const tone = pct === null || pct > 100 ? "bg-rose-500" : pct >= 70 ? "bg-amber-400" : "bg-emerald-500";
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-300"><span>{label}</span><span className="font-mono">{pct === null ? "∞" : `${pct}%`}{detail ? ` · ${detail}` : ""}</span></div>
      <div className="mt-1 h-2.5 rounded bg-slate-700" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, pct ?? 100)} aria-valuetext={pct === null ? "no capacity" : `${pct}%`}>
        <div className={`h-full rounded ${tone} motion-safe:transition-all`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
};
