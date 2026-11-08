/**
 * DataNova Differential Dynamics & Calculus Workbench
 *
 * Continuous differential equations, Phase Portraits (dQ/dt vs Q),
 * and Runge-Kutta 4th-order (RK4) numerical integration for system architecture.
 */

import React, { useState, useMemo } from "react";
import {
  Activity, Zap, ShieldAlert,
  Play, RotateCcw, HelpCircle, CheckCircle2
} from "lucide-react";
import {
  solveSystemODE,
  DEFAULT_ODE_PARAMS,
  type SystemODEParams,
  type ODESimulationResult,
} from "../differentialEngine";
import { MathBlock, InlineMath } from "../../components/MathView";

interface DifferentialWorkbenchProps {
  darkMode?: boolean;
}

export const DifferentialWorkbench: React.FC<DifferentialWorkbenchProps> = ({
  darkMode = true,
}) => {
  const [params, setParams] = useState<SystemODEParams>(DEFAULT_ODE_PARAMS);
  const [activePreset, setActivePreset] = useState<string>("default");
  const [showFormulaProof, setShowFormulaProof] = useState<boolean>(true);

  // Compute numerical solution via 4th-order Runge-Kutta
  const simulation: ODESimulationResult = useMemo(() => {
    return solveSystemODE(params, 60, 0.25);
  }, [params]);

  const updateParam = (key: keyof SystemODEParams, val: number) => {
    setParams((prev) => ({ ...prev, [key]: val }));
    setActivePreset("custom");
  };

  const applyPreset = (presetKey: string) => {
    setActivePreset(presetKey);
    if (presetKey === "default") {
      setParams(DEFAULT_ODE_PARAMS);
    } else if (presetKey === "black-friday") {
      setParams({
        ...DEFAULT_ODE_PARAMS,
        lambdaNominal: 600,
        lambdaSurge: 1800,
        surgeStartTime: 8,
        surgeDuration: 30,
        thrashingBeta: 0.0025,
      });
    } else if (presetKey === "cascading-collapse") {
      setParams({
        ...DEFAULT_ODE_PARAMS,
        lambdaNominal: 500,
        lambdaSurge: 1500,
        cascadeAlpha: 0.85,
        recoveryGamma: 0.2,
        thrashingBeta: 0.004,
      });
    } else if (presetKey === "overdamped-safe") {
      setParams({
        ...DEFAULT_ODE_PARAMS,
        lambdaNominal: 400,
        lambdaSurge: 800,
        dampingZeta: 1.25,
        naturalFreqOmega: 0.65,
        thrashingBeta: 0.0008,
      });
    } else if (presetKey === "thrashing-oscillation") {
      setParams({
        ...DEFAULT_ODE_PARAMS,
        lambdaNominal: 500,
        lambdaSurge: 1100,
        dampingZeta: 0.25,
        naturalFreqOmega: 0.85,
        thrashingBeta: 0.003,
      });
    }
  };

  // Prepare SVG dimensions for time-series trajectory
  const svgWidth = 720;
  const svgHeight = 220;
  const padding = 36;
  const plotW = svgWidth - padding * 2;
  const plotH = svgHeight - padding * 2;

  // Max values for auto-scaling
  const maxTime = 60;
  const maxQueue = Math.max(100, simulation.peakQueue * 1.15);
  const maxLatency = Math.max(250, simulation.peakLatency * 1.15);

  // SVG polyline coordinates generator
  const queuePoints = simulation.trajectory
    .map((p) => {
      const x = padding + (p.t / maxTime) * plotW;
      const y = padding + plotH - (p.queue / maxQueue) * plotH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const latencyPoints = simulation.trajectory
    .map((p) => {
      const x = padding + (p.t / maxTime) * plotW;
      const y = padding + plotH - (p.latencyP95 / maxLatency) * plotH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const arrivalPoints = simulation.trajectory
    .map((p) => {
      const x = padding + (p.t / maxTime) * plotW;
      const y = padding + plotH - (p.lambda / 3000) * plotH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className={`space-y-6 transition-colors ${darkMode ? "text-[#f4f4f5]" : "text-[#111113]"}`}>
      {/* Hero Mathematical Banner */}
      <div className={`p-6 rounded-2xl border backdrop-blur-md shadow-2xl relative overflow-hidden ${
        darkMode ? "border-[#27272a] bg-[#121214]" : "border-[#e4e2dd] bg-[#ffffff]"
      }`}>
        <div
          aria-hidden
          className={`pointer-events-none absolute -top-16 -right-16 w-80 h-80 rounded-full blur-3xl opacity-20 ${
            simulation.isCongestionCollapsed ? "bg-rose-500" : "bg-amber-500"
          }`}
        />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/25">
                Runge-Kutta 4th-Order (RK4) Continuous Calculus
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                simulation.stabilityEigenvalue < 0
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
              }`}>
                {simulation.stabilityEigenvalue < 0 ? "Asymptotically Stable" : "Unstable Bifurcation"}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              Continuous System Dynamics & Differential Equations Engine
            </h2>
            <p className={`text-xs sm:text-sm leading-relaxed ${darkMode ? "text-[#a1a1aa]" : "text-[#52525b]"}`}>
              Solving coupled non-linear differential equations governing microservice queue fluid dynamics,
              Fokker-Planck latency diffusion drift, graph epidemic failure propagation, and PID closed-loop control.
            </p>
          </div>

          {/* Quick Mathematical Presets */}
          <div className="flex flex-wrap lg:flex-col gap-2 shrink-0">
            <div className="text-[11px] font-mono text-zinc-400 font-semibold">Calculus Presets:</div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: "default", label: "Nominal Load" },
                { id: "black-friday", label: "Black Friday Surge" },
                { id: "cascading-collapse", label: "Cascading Collapse" },
                { id: "overdamped-safe", label: "Overdamped PID" },
                { id: "thrashing-oscillation", label: "Underdamped Thrash" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border ${
                    activePreset === p.id
                      ? "bg-amber-500 text-zinc-950 border-amber-500 shadow-md shadow-amber-500/20"
                      : darkMode
                      ? "bg-[#18181b] border-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] hover:border-zinc-600"
                      : "bg-[#f4f4f5] border-[#e4e4e7] text-[#52525b] hover:text-[#111113]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Real-Time Mathematical Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-zinc-800/60">
          <div className={`p-3 rounded-xl border ${darkMode ? "bg-[#09090b] border-[#27272a]" : "bg-[#fbfaf8] border-[#e4e2dd]"}`}>
            <div className="text-[10px] font-mono uppercase text-zinc-400 font-semibold">Lyapunov Stability Eigenvalue</div>
            <div className="text-lg font-black font-mono text-amber-400 mt-0.5">
              <InlineMath math={`\\lambda_J = ${simulation.stabilityEigenvalue.toFixed(3)}`} darkMode={darkMode} />
            </div>
            <div className="text-[10px] text-zinc-400">
              {simulation.stabilityEigenvalue < 0 ? "Negative real part: stable attractor" : "Positive: divergent divergence"}
            </div>
          </div>

          <div className={`p-3 rounded-xl border ${darkMode ? "bg-[#09090b] border-[#27272a]" : "bg-[#fbfaf8] border-[#e4e2dd]"}`}>
            <div className="text-[10px] font-mono uppercase text-zinc-400 font-semibold">Peak Queue Differential</div>
            <div className="text-lg font-black font-mono text-cyan-400 mt-0.5">
              <InlineMath math={`Q_{\\max} = ${simulation.peakQueue}\\text{ req}`} darkMode={darkMode} />
            </div>
            <div className="text-[10px] text-zinc-400">
              Max fluid buffer accumulation
            </div>
          </div>

          <div className={`p-3 rounded-xl border ${darkMode ? "bg-[#09090b] border-[#27272a]" : "bg-[#fbfaf8] border-[#e4e2dd]"}`}>
            <div className="text-[10px] font-mono uppercase text-zinc-400 font-semibold">Peak Latency Drift</div>
            <div className={`text-lg font-black font-mono mt-0.5 ${
              simulation.peakLatency > 220 ? "text-rose-400" : "text-amber-400"
            }`}>
              <InlineMath math={`L_{p95} = ${simulation.peakLatency}\\text{ ms}`} darkMode={darkMode} />
            </div>
            <div className="text-[10px] text-zinc-400">
              Diffusion relaxation supremum
            </div>
          </div>

          <div className={`p-3 rounded-xl border ${darkMode ? "bg-[#09090b] border-[#27272a]" : "bg-[#fbfaf8] border-[#e4e2dd]"}`}>
            <div className="text-[10px] font-mono uppercase text-zinc-400 font-semibold">Relaxation Recovery Time</div>
            <div className="text-lg font-black font-mono text-emerald-400 mt-0.5">
              <InlineMath math={`t_{\\text{relax}} = ${simulation.recoveryTimeSeconds > 200 ? "\\infty" : simulation.recoveryTimeSeconds + "\\text{s}"}`} darkMode={darkMode} />
            </div>
            <div className="text-[10px] text-zinc-400">
              {simulation.isCongestionCollapsed ? "System trapped in collapse" : "Full equilibrium restored"}
            </div>
          </div>
        </div>
      </div>

      {/* Main Simulation Trajectory Canvas */}
      <div className={`p-5 rounded-2xl border space-y-4 shadow-xl ${
        darkMode ? "bg-[#121214] border-[#27272a]" : "bg-[#ffffff] border-[#e4e2dd]"
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 border-zinc-800/60">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-amber-500" />
            <h3 className="text-sm font-bold">Continuous Trajectory Integration [0s, 60s]</h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
              dt = 0.25s (240 integration steps)
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-amber-400 rounded-full" />
              <span>Queue $Q(t)$</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-rose-400 rounded-full" />
              <span>Latency $L(t)$</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-blue-400 rounded-full" />
              <span>Arrival $\lambda(t)$</span>
            </div>
          </div>
        </div>

        {/* SVG Trajectory Chart */}
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-56 select-none"
          >
            {/* Background Grid */}
            <defs>
              <linearGradient id="queueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Coordinate Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
              const y = padding + plotH * pct;
              return (
                <line
                  key={pct}
                  x1={padding}
                  y1={y}
                  x2={svgWidth - padding}
                  y2={y}
                  stroke={darkMode ? "#27272a" : "#e4e4e7"}
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
              );
            })}

            {[0, 15, 30, 45, 60].map((t) => {
              const x = padding + (t / maxTime) * plotW;
              return (
                <g key={t}>
                  <line
                    x1={x}
                    y1={padding}
                    x2={x}
                    y2={svgHeight - padding}
                    stroke={darkMode ? "#27272a" : "#e4e4e7"}
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  <text
                    x={x}
                    y={svgHeight - padding + 16}
                    textAnchor="middle"
                    fill={darkMode ? "#71717a" : "#a1a1aa"}
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {t}s
                  </text>
                </g>
              );
            })}

            {/* Trajectory Curves */}
            <polyline
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.5"
              strokeDasharray="2 2"
              opacity="0.6"
              points={arrivalPoints}
            />

            <polyline
              fill="none"
              stroke="#f43f5e"
              strokeWidth="2"
              points={latencyPoints}
            />

            <polyline
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2.5"
              points={queuePoints}
            />

            {/* Surge Active Highlight Region */}
            <rect
              x={padding + (params.surgeStartTime / maxTime) * plotW}
              y={padding}
              width={(params.surgeDuration / maxTime) * plotW}
              height={plotH}
              fill="#f59e0b"
              fillOpacity="0.05"
              stroke="#f59e0b"
              strokeDasharray="3 3"
              strokeWidth="1"
              strokeOpacity="0.3"
            />
          </svg>
        </div>
      </div>

      {/* Grid: Differential Parameters & 2D Phase Portrait */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Differential Equation Parameters Control */}
        <div className={`p-5 rounded-2xl border space-y-4 ${
          darkMode ? "bg-[#121214] border-[#27272a]" : "bg-[#ffffff] border-[#e4e2dd]"
        }`}>
          <div className="flex items-center justify-between border-b pb-3 border-zinc-800/60">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Zap size={15} className="text-amber-500" />
              <span>Differential Calculus Parameters</span>
            </h3>
            <button
              onClick={() => applyPreset("default")}
              className={`p-1.5 rounded-lg border text-xs transition-colors ${
                darkMode ? "border-[#27272a] hover:bg-zinc-800 text-zinc-400" : "border-zinc-200 hover:bg-zinc-100 text-zinc-600"
              }`}
              title="Reset parameters to defaults"
            >
              <RotateCcw size={12} />
            </button>
          </div>

          <div className="space-y-4 text-xs font-mono">
            {/* Parameter 1: Nominal Arrival */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-zinc-400">Nominal Arrival Rate (λ₀):</span>
                <span className="font-bold text-amber-400">{params.lambdaNominal} req/s</span>
              </div>
              <input
                type="range"
                min={200}
                max={1000}
                step={25}
                value={params.lambdaNominal}
                onChange={(e) => updateParam("lambdaNominal", Number(e.target.value))}
                className="w-full accent-amber-500 h-1.5 rounded-lg cursor-pointer bg-zinc-700"
              />
            </div>

            {/* Parameter 2: Surge Shock */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-zinc-400">Surge Shock Amplitude (Δλ):</span>
                <span className="font-bold text-rose-400">+{params.lambdaSurge} req/s</span>
              </div>
              <input
                type="range"
                min={0}
                max={2500}
                step={50}
                value={params.lambdaSurge}
                onChange={(e) => updateParam("lambdaSurge", Number(e.target.value))}
                className="w-full accent-rose-500 h-1.5 rounded-lg cursor-pointer bg-zinc-700"
              />
            </div>

            {/* Parameter 3: Max Processing Capacity */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-zinc-400">Max Service Capacity (μ_max):</span>
                <span className="font-bold text-emerald-400">{params.muMax} req/s</span>
              </div>
              <input
                type="range"
                min={600}
                max={2000}
                step={50}
                value={params.muMax}
                onChange={(e) => updateParam("muMax", Number(e.target.value))}
                className="w-full accent-emerald-500 h-1.5 rounded-lg cursor-pointer bg-zinc-700"
              />
            </div>

            {/* Parameter 4: Thrashing / Lock Contention Penalty */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-zinc-400">Lock Thrashing Factor (β):</span>
                <span className="font-bold text-amber-400">{(params.thrashingBeta * 1000).toFixed(2)} × 10⁻³</span>
              </div>
              <input
                type="range"
                min={0.0005}
                max={0.005}
                step={0.0002}
                value={params.thrashingBeta}
                onChange={(e) => updateParam("thrashingBeta", Number(e.target.value))}
                className="w-full accent-amber-500 h-1.5 rounded-lg cursor-pointer bg-zinc-700"
              />
            </div>

            {/* Parameter 5: Cascading Coupling */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-zinc-400">Cascading Coupling (α):</span>
                <span className="font-bold text-purple-400">{params.cascadeAlpha.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.05}
                max={0.9}
                step={0.05}
                value={params.cascadeAlpha}
                onChange={(e) => updateParam("cascadeAlpha", Number(e.target.value))}
                className="w-full accent-purple-500 h-1.5 rounded-lg cursor-pointer bg-zinc-700"
              />
            </div>

            {/* Parameter 6: Autoscaler Damping Ratio */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-zinc-400">Autoscaler Damping (ζ):</span>
                <span className="font-bold text-cyan-400">{params.dampingZeta.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.15}
                max={1.8}
                step={0.05}
                value={params.dampingZeta}
                onChange={(e) => updateParam("dampingZeta", Number(e.target.value))}
                className="w-full accent-cyan-500 h-1.5 rounded-lg cursor-pointer bg-zinc-700"
              />
            </div>
          </div>
        </div>

        {/* Right: 2D Phase Portrait (dQ/dt vs Q) */}
        <div className={`p-5 rounded-2xl border space-y-4 ${
          darkMode ? "bg-[#121214] border-[#27272a]" : "bg-[#ffffff] border-[#e4e2dd]"
        }`}>
          <div className="flex items-center justify-between border-b pb-3 border-zinc-800/60">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Play size={15} className="text-cyan-400" />
              <span>Phase Plane Analysis (dQ/dt vs Q)</span>
            </h3>
            <span className="text-[10px] font-mono text-zinc-400">Equilibrium Nullcline</span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            The phase portrait shows directional flow vectors in the state space. Stable fixed points occur where
            dQ/dt = 0 with negative gradient ∂(dQ/dt)/∂Q &lt; 0.
          </p>

          {/* Phase Portrait Table and Flow Vectors */}
          <div className="space-y-2">
            <div className="grid grid-cols-4 text-[10px] font-mono text-zinc-400 border-b border-zinc-800 pb-1 font-semibold">
              <span>Queue ($Q$)</span>
              <span>Effective $\mu(Q)$</span>
              <span>Derivative $dQ/dt$</span>
              <span>Flow Direction</span>
            </div>
            {simulation.phasePortrait.map((p) => {
              const isFlowingDown = p.dqDt < 0;
              const isEquilibrium = Math.abs(p.dqDt) < 15;
              return (
                <div
                  key={p.q}
                  className={`grid grid-cols-4 items-center text-xs font-mono p-1.5 rounded transition-colors ${
                    isEquilibrium
                      ? "bg-amber-500/10 text-amber-400 font-bold border border-amber-500/25"
                      : "text-zinc-300"
                  }`}
                >
                  <span>{p.q} req</span>
                  <span>{Math.round(params.lambdaNominal - p.dqDt)} req/s</span>
                  <span className={p.dqDt > 0 ? "text-rose-400 font-bold" : "text-emerald-400"}>
                    {p.dqDt > 0 ? `+${Math.round(p.dqDt)}` : Math.round(p.dqDt)}/s
                  </span>
                  <span className="flex items-center gap-1 text-[11px]">
                    {isEquilibrium ? (
                      <span className="text-amber-400 flex items-center gap-1 font-bold">
                        <CheckCircle2 size={12} /> Fixed Point
                      </span>
                    ) : isFlowingDown ? (
                      <span className="text-emerald-400 font-semibold">← Contracting</span>
                    ) : (
                      <span className="text-rose-400 font-semibold">→ Diverging</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Verdict Box */}
          <div className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
            simulation.isCongestionCollapsed
              ? "bg-rose-950/20 border-rose-500/40 text-rose-200"
              : "bg-emerald-950/20 border-emerald-500/40 text-emerald-200"
          }`}>
            <div className="font-bold flex items-center gap-1.5 font-mono uppercase text-[11px]">
              {simulation.isCongestionCollapsed ? (
                <>
                  <ShieldAlert size={14} className="text-rose-400" />
                  <span>Mathematical Verdict: Catastrophic Congestion Collapse</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  <span>Mathematical Verdict: Globally Asymptotically Stable</span>
                </>
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-300">
              {simulation.isCongestionCollapsed
                ? "The lock contention penalty β drives the derivative dQ/dt positive even after surge cessation. The queue diverges without exterior throttling."
                : "The system possesses a robust negative Jacobian eigenvalue across all operating regimes, guaranteeing bounded-input bounded-output (BIBO) stability."}
            </p>
          </div>
        </div>
      </div>

      {/* Formal Differential Equations Mathematical Exposition */}
      <div className={`p-5 rounded-2xl border space-y-4 ${
        darkMode ? "bg-[#121214] border-[#27272a]" : "bg-[#ffffff] border-[#e4e2dd]"
      }`}>
        <div className="flex items-center justify-between border-b pb-3 border-zinc-800/60">
          <div className="flex items-center gap-2">
            <HelpCircle size={15} className="text-amber-500" />
            <h3 className="text-sm font-bold">Coupled Differential Equations Formulation</h3>
          </div>
          <button
            onClick={() => setShowFormulaProof(!showFormulaProof)}
            className="text-xs font-mono text-amber-500 hover:underline"
          >
            {showFormulaProof ? "Collapse Formulas" : "Expand Formulas"}
          </button>
        </div>

        {showFormulaProof && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Equation 1: Fluid Queue */}
            <div className={`p-4 rounded-xl border ${darkMode ? "bg-[#09090b] border-[#27272a]" : "bg-[#fbfaf8] border-[#e4e2dd]"}`}>
              <div className="font-mono text-[11px] font-bold text-amber-400 mb-1">
                1. Fluid-Flow Queue Dynamics ODE
              </div>
              <MathBlock
                math="\frac{dQ(t)}{dt} = \lambda(t) - \mu_{\max} \left(\frac{Q^m(t)}{K^m + Q^m(t)}\right) e^{-\beta Q(t)}"
                darkMode={darkMode}
              />
              <p className="text-[11px] text-zinc-400 leading-relaxed mt-2">
                Arrivals $\lambda(t)$ minus Hill-type non-linear service capacity with exponential lock-thrashing decay $\beta$.
              </p>
            </div>

            {/* Equation 2: Latency Diffusion */}
            <div className={`p-4 rounded-xl border ${darkMode ? "bg-[#09090b] border-[#27272a]" : "bg-[#fbfaf8] border-[#e4e2dd]"}`}>
              <div className="font-mono text-[11px] font-bold text-rose-400 mb-1">
                2. Fokker-Planck Latency Drift ODE
              </div>
              <MathBlock
                math="\frac{dL(t)}{dt} = \frac{1}{\tau} \left(L_0 + \frac{Q(t)}{\mu_{\text{eff}}} \cdot 1000 - L(t)\right) + \kappa \cdot \max\left(0, \frac{dQ}{dt}\right)"
                darkMode={darkMode}
              />
              <p className="text-[11px] text-zinc-400 leading-relaxed mt-2">
                Ornstein-Uhlenbeck drift relaxation with kinetic shock momentum term <InlineMath math="\kappa \frac{dQ}{dt}" darkMode={darkMode} />.
              </p>
            </div>

            {/* Equation 3: Cascading Failure Epidemic */}
            <div className={`p-4 rounded-xl border ${darkMode ? "bg-[#09090b] border-[#27272a]" : "bg-[#fbfaf8] border-[#e4e2dd]"}`}>
              <div className="font-mono text-[11px] font-bold text-purple-400 mb-1">
                3. Network Cascading Failure Spreading
              </div>
              <MathBlock
                math="\frac{dS_i(t)}{dt} = \eta_i \frac{Q_i(t)}{K_i} - \gamma_i S_i(t) + \alpha \sum_{j \in \text{in}(i)} W_{ji} S_j(t) (1 - S_i(t))"
                darkMode={darkMode}
              />
              <p className="text-[11px] text-zinc-400 leading-relaxed mt-2">
                Kermack-McKendrick epidemic spreading of service degradation across dependency adjacency matrix <InlineMath math="W_{ji}" darkMode={darkMode} />.
              </p>
            </div>

            {/* Equation 4: Closed Loop Autoscaler Control */}
            <div className={`p-4 rounded-xl border ${darkMode ? "bg-[#09090b] border-[#27272a]" : "bg-[#fbfaf8] border-[#e4e2dd]"}`}>
              <div className="font-mono text-[11px] font-bold text-cyan-400 mb-1">
                4. Autonomous Autoscaler Harmonic Oscillator
              </div>
              <MathBlock
                math="\frac{d^2 C(t)}{dt^2} + 2\zeta \omega_n \frac{dC(t)}{dt} + \omega_n^2 C(t) = K_p (L(t) - L_{\text{SLA}})"
                darkMode={darkMode}
              />
              <p className="text-[11px] text-zinc-400 leading-relaxed mt-2">
                Second-order continuous control equation of Kubernetes HPA preventing pod thrashing and limit cycles.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
