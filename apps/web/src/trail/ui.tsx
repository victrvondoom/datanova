/**
 * Shared visual primitives for the TRACEN trail.
 *
 * Consistent visual language: states are communicated with label + icon +
 * color (never color alone), diagrams are interactive CSS/SVG components,
 * and everything is keyboard-accessible with visible focus states.
 */
import React from "react";

export type SysState =
  | "healthy"
  | "processing"
  | "waiting"
  | "failed"
  | "retrying"
  | "blocked"
  | "degraded"
  | "recovered"
  | "idle";

const STATE_STYLES: Record<SysState, { label: string; cls: string; icon: string }> = {
  healthy: { label: "Healthy", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/40", icon: "✓" },
  processing: { label: "Processing", cls: "bg-sky-500/15 text-sky-400 border-sky-500/40", icon: "⟳" },
  waiting: { label: "Waiting", cls: "bg-slate-500/15 text-slate-300 border-slate-500/40", icon: "…" },
  failed: { label: "Failed", cls: "bg-rose-500/15 text-rose-400 border-rose-500/40", icon: "✗" },
  retrying: { label: "Retrying", cls: "bg-amber-500/15 text-amber-400 border-amber-500/40", icon: "↻" },
  blocked: { label: "Blocked", cls: "bg-rose-500/15 text-rose-300 border-rose-500/50", icon: "⛔" },
  degraded: { label: "Degraded", cls: "bg-amber-500/15 text-amber-300 border-amber-500/40", icon: "⚠" },
  recovered: { label: "Recovered", cls: "bg-teal-500/15 text-teal-400 border-teal-500/40", icon: "✔" },
  idle: { label: "Idle", cls: "bg-slate-500/10 text-slate-400 border-slate-500/30", icon: "○" },
};

export const StateBadge: React.FC<{ state: SysState; label?: string }> = ({ state, label }) => {
  const s = STATE_STYLES[state];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-semibold ${s.cls}`}
    >
      <span aria-hidden="true">{s.icon}</span>
      {label ?? s.label}
    </span>
  );
};

export const SimCard: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({
  title,
  hint,
  children,
}) => (
  <section className="rounded-xl border border-slate-600/40 bg-slate-800/60 p-4 sm:p-5">
    <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
      <h4 className="text-sm font-bold uppercase tracking-wider text-sky-300">{title}</h4>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
    {children}
  </section>
);

export const Node: React.FC<{
  label: string;
  state?: SysState;
  sub?: string;
  onClick?: () => void;
  active?: boolean;
}> = ({ label, state, sub, onClick, active }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className={`text-left rounded-lg border px-3 py-2 min-w-[7rem] text-center transition-colors ${
      active ? "border-sky-400 bg-sky-500/15" : "border-slate-500/50 bg-slate-700/50"
    } ${onClick ? "hover:border-sky-400 cursor-pointer" : "cursor-default"}`}
  >
    <div className="text-sm font-semibold text-slate-100">{label}</div>
    {sub && <div className="text-[11px] text-slate-400 font-mono">{sub}</div>}
    {state && (
      <div className="mt-1 flex justify-center">
        <StateBadge state={state} />
      </div>
    )}
  </button>
);

export const Arrow: React.FC<{ label?: string; dashed?: boolean; blocked?: boolean }> = ({
  label,
  dashed,
  blocked,
}) => (
  <div className="flex flex-col items-center justify-center min-w-[3rem] shrink-0">
    <span
      aria-hidden="true"
      className={`text-lg leading-none font-mono ${
        blocked ? "text-rose-400" : dashed ? "text-slate-500" : "text-sky-400"
      }`}
    >
      {blocked ? "⃠" : dashed ? "┄→" : "→"}
    </span>
    {label && <span className="text-[10px] text-slate-400 mt-0.5">{label}</span>}
  </div>
);

export const Stat: React.FC<{ label: string; value: string | number; tone?: "ok" | "bad" | "neutral" }> = ({
  label,
  value,
  tone = "neutral",
}) => (
  <div className="rounded-lg bg-slate-900/60 border border-slate-600/40 px-3 py-2">
    <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
    <div
      className={`text-lg font-bold font-mono ${
        tone === "ok" ? "text-emerald-400" : tone === "bad" ? "text-rose-400" : "text-slate-100"
      }`}
    >
      {value}
    </div>
  </div>
);

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }
> = ({ variant = "ghost", className = "", ...rest }) => (
  <button
    type="button"
    {...rest}
    className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-40 disabled:cursor-not-allowed ${
      variant === "primary"
        ? "bg-sky-500/20 border-sky-400 text-sky-200 hover:bg-sky-500/30"
        : variant === "danger"
          ? "bg-rose-500/15 border-rose-500/50 text-rose-300 hover:bg-rose-500/25"
          : "bg-slate-700/40 border-slate-500/50 text-slate-200 hover:bg-slate-700/70"
    } ${className}`}
  />
);

export const Callout: React.FC<{
  kind: "nuance" | "warning" | "info";
  title: string;
  children: React.ReactNode;
}> = ({ kind, title, children }) => (
  <div
    className={`rounded-xl border p-3 text-sm ${
      kind === "nuance"
        ? "border-violet-500/40 bg-violet-500/10"
        : kind === "warning"
          ? "border-amber-500/40 bg-amber-500/10"
          : "border-sky-500/40 bg-sky-500/10"
    }`}
  >
    <div className="font-bold text-xs uppercase tracking-wider mb-1 flex items-center gap-2">
      <span aria-hidden="true">{kind === "nuance" ? "ⓘ" : kind === "warning" ? "⚠" : "ℹ"}</span>
      {title}
    </div>
    <div className="text-slate-300 leading-relaxed">{children}</div>
  </div>
);

export const LogView: React.FC<{ lines: string[]; max?: number }> = ({ lines, max = 200 }) => (
  <div
    className="rounded-lg bg-slate-950/80 border border-slate-700/50 p-3 font-mono text-xs text-slate-300 max-h-48 overflow-y-auto"
    role="log"
    aria-label="Simulation log"
  >
    {lines.length === 0 ? (
      <span className="text-slate-600">(no events yet — use the controls)</span>
    ) : (
      lines.slice(-max).map((l, i) => (
        <div key={i} className="whitespace-pre-wrap">
          {l}
        </div>
      ))
    )}
  </div>
);
