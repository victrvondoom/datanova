/**
 * Datanova Atlas — design system primitives (Campaign 06, Task 03).
 * Premium workstation tokens: deep graphite canvas, restrained semantic
 * accents, consistent focus/hover/disabled states, and label+icon+shape
 * (never color alone) status communication.
 */

import React from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle, ShieldQuestion } from "lucide-react";

// eslint-disable-next-line react/only-export-components
export const STATUS_ICON: Record<string, React.ReactNode> = {
  ok: <CheckCircle2 size={13} aria-hidden />,
  warn: <AlertTriangle size={13} aria-hidden />,
  bad: <XCircle size={13} aria-hidden />,
  info: <Info size={13} aria-hidden />,
  unknown: <ShieldQuestion size={13} aria-hidden />,
};

// eslint-disable-next-line react/only-export-components
export const STATUS_CLS: Record<string, string> = {
  ok: "bg-emerald-500/10 text-emerald-300 border-emerald-500/40",
  warn: "bg-amber-500/10 text-amber-300 border-amber-500/40",
  bad: "bg-rose-500/10 text-rose-300 border-rose-500/40",
  info: "bg-sky-500/10 text-sky-300 border-sky-500/40",
  unknown: "bg-slate-500/10 text-slate-300 border-slate-500/40",
};

/** Status badge: label + icon + color — meaning never by color alone. */
export const ABadge: React.FC<{ status: keyof typeof STATUS_CLS; label: string; title?: string }> = ({ status, label, title }) => (
  <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-semibold ${STATUS_CLS[status]}`}
    title={title ?? label}>
    {STATUS_ICON[status]}
    {label}
  </span>
);

export const AButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "default" | "danger" }> =
  ({ variant = "default", className = "", ...props }) => (
    <button
      {...props}
      className={`rounded-md px-2.5 py-1.5 text-xs font-semibold border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 disabled:opacity-40 disabled:cursor-not-allowed ${
        variant === "primary"
          ? "border-sky-500/60 bg-sky-500/20 text-sky-100 hover:bg-sky-500/30"
          : variant === "danger"
            ? "border-rose-500/50 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
            : "border-slate-600 bg-slate-800/70 text-slate-200 hover:bg-slate-700/70"
      } ${className}`}
    />
  );

export const APanel: React.FC<{ title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode }> =
  ({ title, subtitle, right, children }) => (
    <section aria-label={title} className="rounded-lg border border-slate-700/50 bg-slate-900/50 p-3 mb-3">
      <header className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h3 className="text-[13px] font-bold uppercase tracking-wider text-slate-200">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </header>
      {children}
    </section>
  );

export const AMetric: React.FC<{ label: string; value: string | number; hint?: string }> = ({ label, value, hint }) => (
  <div className="rounded-lg border border-slate-700/50 bg-slate-900/60 px-3 py-2">
    <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
    <div className="text-lg font-bold text-slate-100 leading-tight">{value}</div>
    {hint && <div className="text-[10px] text-slate-500 mt-0.5">{hint}</div>}
  </div>
);

export const ADialog: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
    role="dialog" aria-modal="true" aria-label={title}>
    <div className="w-full max-w-lg rounded-xl border border-slate-600 bg-slate-900 p-4 shadow-2xl">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-slate-100">{title}</h2>
        <AButton aria-label="Close dialog" onClick={onClose}>Close</AButton>
      </div>
      {children}
    </div>
  </div>
);

export const AField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block text-xs text-slate-300 space-y-1">
    <span className="text-[11px] uppercase tracking-wider text-slate-400">{label}</span>
    {children}
  </label>
);

export const AInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = "", ...props }) => (
  <input {...props} className={`w-full rounded-md border border-slate-600 bg-slate-800/80 px-2 py-1.5 text-xs text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 ${className}`} />
);

export const ASelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className = "", ...props }) => (
  <select {...props} className={`w-full rounded-md border border-slate-600 bg-slate-800/80 px-2 py-1.5 text-xs text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 ${className}`} />
);

export const AAnnouncer: React.FC<{ message: string }> = ({ message }) => (
  <p role="status" aria-live="polite" className="sr-only">{message}</p>
);
