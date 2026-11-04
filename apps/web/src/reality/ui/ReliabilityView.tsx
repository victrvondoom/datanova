/**
 * Campaign 07 — Tasks 21–25: Reliability, SLOs & Anomaly Intelligence UI
 *
 * High-Density Reliability & SLO Cockpit:
 * Visualizes SLO compliance, error budget burn rates, critical-path latency
 * bottlenecks, saturation indicators, and statistical anomaly alerts.
 */

import React, { useMemo } from "react";
import {
  Zap, Clock, TrendingUp, ShieldCheck, AlertTriangle
} from "lucide-react";
import type { NormalizedSpan } from "../connectors/otel";
import { ReliabilityEngine, type ServiceSloConfig } from "../reliability";

interface ReliabilityViewProps {
  spans: NormalizedSpan[];
  driftCount: number;
  reliabilityEngine: ReliabilityEngine;
}

export const ReliabilityView: React.FC<ReliabilityViewProps> = ({
  spans,
  driftCount,
  reliabilityEngine,
}) => {
  const configs: ServiceSloConfig[] = useMemo(
    () => [
      { serviceId: "Client", name: "Client", availabilityTarget: 0.999, latencyTargetMs: 250, latencyRatioTarget: 0.95, evaluationWindowHours: 1 },
      { serviceId: "API Gateway", name: "API Gateway", availabilityTarget: 0.999, latencyTargetMs: 200, latencyRatioTarget: 0.95, evaluationWindowHours: 1 },
      { serviceId: "Order Service", name: "Order Service", availabilityTarget: 0.995, latencyTargetMs: 150, latencyRatioTarget: 0.95, evaluationWindowHours: 1 },
      { serviceId: "Pricing Service", name: "Pricing Service", availabilityTarget: 0.99, latencyTargetMs: 100, latencyRatioTarget: 0.9, evaluationWindowHours: 1 },
      { serviceId: "Order Database", name: "Order Database", availabilityTarget: 0.9999, latencyTargetMs: 50, latencyRatioTarget: 0.99, evaluationWindowHours: 1 },
    ],
    []
  );

  const sloEvaluations = useMemo(
    () => reliabilityEngine.evaluateSlos(spans, configs),
    [reliabilityEngine, spans, configs]
  );

  const criticalPath = useMemo(
    () => reliabilityEngine.calculateCriticalPath(spans),
    [reliabilityEngine, spans]
  );

  const scorecard = useMemo(
    () => reliabilityEngine.calculateScorecard(sloEvaluations, driftCount, 85),
    [reliabilityEngine, sloEvaluations, driftCount]
  );

  const anomalies = useMemo(() => {
    return reliabilityEngine.detectAnomalies(
      [
        { serviceId: "Order Service", metricName: "p95_latency", value: 340 },
        { serviceId: "Pricing Service", metricName: "connection_count", value: 88 },
      ],
      {
        "Order Service:p95_latency": { mean: 120, stdDev: 40 },
        "Pricing Service:connection_count": { mean: 25, stdDev: 12 },
      }
    );
  }, [reliabilityEngine]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-white tracking-tight">Operational Reliability & SLO Intelligence</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30">
              SRE RADAR
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Real-time SLI/SLO evaluation, error budget consumption, critical path request tracing, and statistical anomaly detection.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950/70 flex items-center gap-2">
            <ShieldCheck size={12} className="text-emerald-400" />
            <div className="text-left">
              <div className="text-[9px] font-mono uppercase text-slate-500 font-bold">SLO Target</div>
              <div className="text-[11px] font-mono text-emerald-300 font-semibold">99.9% Production SLA</div>
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950/70 flex items-center gap-2">
            <AlertTriangle size={12} className="text-amber-400" />
            <div className="text-left">
              <div className="text-[9px] font-mono uppercase text-slate-500 font-bold">Anomalies</div>
              <div className="text-[11px] font-mono text-amber-300 font-semibold">{anomalies.length} Flagged</div>
            </div>
          </div>
        </div>
      </div>

      {/* Holistic Operational Scorecard */}
      <div className="rounded-xl border border-slate-800/90 bg-slate-900/60 backdrop-blur-md p-6 space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <ShieldCheck size={22} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">Operational Reliability Scorecard</h3>
              <p className="text-xs text-slate-400">Synthesized multi-dimensional reliability posture</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-slate-950/80 px-4 py-2 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 font-medium">Composite Score:</span>
            <span
              className={`text-2xl font-black font-mono tracking-tight ${
                scorecard.overallScore >= 80 ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {scorecard.overallScore} / 100
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {Object.entries(scorecard.dimensions).map(([key, dim]) => (
            <div
              key={key}
              className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="capitalize font-bold text-slate-300 tracking-wide text-xs">{key}</span>
                  <span
                    className={`font-mono font-bold text-xs px-1.5 py-0.5 rounded ${
                      dim.status === "good" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"
                    }`}
                  >
                    {dim.score}%
                  </span>
                </div>
                <div className="w-full bg-slate-900 h-1.5 rounded-full mt-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${dim.status === "good" ? "bg-emerald-400" : "bg-amber-400"}`}
                    style={{ width: `${dim.score}%` }}
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-2.5 line-clamp-2 leading-relaxed">{dim.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* SLO Explorer Table */}
      <div className="rounded-xl border border-slate-800/90 bg-slate-900/60 backdrop-blur-md p-5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-sky-500/10 border border-sky-500/30">
              <Zap size={16} className="text-sky-400" />
            </div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              Service SLO Compliance ({sloEvaluations.length} Services)
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Burn rate &gt;1.0 indicates elevated risk
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px] tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Service</th>
                <th className="py-2.5 px-3">Availability SLI</th>
                <th className="py-2.5 px-3">Latency SLI</th>
                <th className="py-2.5 px-3">Error Budget</th>
                <th className="py-2.5 px-3">Burn Rate</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {sloEvaluations.map((slo) => (
                <tr key={slo.serviceId} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${slo.status === "healthy" ? "bg-emerald-400" : slo.status === "warning" ? "bg-amber-400" : "bg-rose-400"}`} />
                    <span>{slo.name}</span>
                  </td>
                  <td className="py-3 px-3 font-mono">
                    <span className={`font-semibold ${slo.availabilityMet ? "text-emerald-400" : "text-rose-400"}`}>
                      {(slo.availabilitySli * 100).toFixed(2)}%
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono">
                    <span className={`font-semibold ${slo.latencyMet ? "text-emerald-400" : "text-amber-400"}`}>
                      {(slo.latencySli * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono">
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-400 h-full rounded-full transition-all"
                          style={{ width: `${Math.round(slo.errorBudgetRemaining * 100)}%` }}
                        />
                      </div>
                      <span className="font-semibold">{(slo.errorBudgetRemaining * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-sky-400">{slo.burnRate}x</td>
                  <td className="py-3 px-3 text-right">
                    <span
                      className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase ${
                        slo.status === "healthy"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : slo.status === "warning"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                      }`}
                    >
                      {slo.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Critical Path Latency & Statistical Anomalies */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Critical Path Breakdown */}
        <div className="rounded-xl border border-slate-800/90 bg-slate-900/60 backdrop-blur-md p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-amber-500/10 border border-amber-500/30">
                <Clock size={16} className="text-amber-400" />
              </div>
              <h3 className="text-sm font-bold text-white tracking-wide">Critical-Path Latency Analysis</h3>
            </div>
            {criticalPath && (
              <span className="text-xs font-mono text-amber-300 font-bold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                Total: {criticalPath.totalDurationMs} ms
              </span>
            )}
          </div>

          {criticalPath ? (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-300">
                  <AlertTriangle size={14} />
                  <span>Primary Bottleneck Identified</span>
                </div>
                <p className="leading-relaxed">
                  Primary Bottleneck: <strong>{criticalPath.bottleneckService}</strong> contributes{" "}
                  <strong>{criticalPath.bottleneckContributionPercentage}%</strong> of total request duration.
                </p>
              </div>

              <div className="space-y-2">
                {criticalPath.segments.map((seg) => (
                  <div key={seg.spanId} className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs">
                    <div className="flex items-center justify-between font-semibold">
                      <span className={seg.isBottleneck ? "text-amber-300 font-bold" : "text-white"}>
                        {seg.serviceName} &bull; {seg.operationName}
                      </span>
                      <span className="font-mono text-slate-300">{seg.selfDurationMs} ms</span>
                    </div>
                    <div className="w-full bg-slate-900 h-2 rounded-full mt-2.5 overflow-hidden p-0.5 border border-slate-800/60">
                      <div
                        className={`h-full rounded-full transition-all ${
                          seg.isBottleneck ? "bg-gradient-to-r from-amber-400 to-orange-500" : "bg-gradient-to-r from-sky-400 to-blue-500"
                        }`}
                        style={{ width: `${Math.max(5, seg.percentageOfTrace)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 p-8 text-center border border-dashed border-slate-800 rounded-lg">
              No traces available for critical path calculation.
            </div>
          )}
        </div>

        {/* Statistical Anomalies */}
        <div className="rounded-xl border border-slate-800/90 bg-slate-900/60 backdrop-blur-md p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-rose-500/10 border border-rose-500/30">
                <TrendingUp size={16} className="text-rose-400" />
              </div>
              <h3 className="text-sm font-bold text-white tracking-wide">Statistical Anomaly Alerts</h3>
            </div>
            <span className="text-xs font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-800">
              Z-Score &gt; 2.5&sigma;
            </span>
          </div>

          <div className="space-y-3">
            {anomalies.map((anom, i) => (
              <div
                key={i}
                className="p-3.5 rounded-xl border border-rose-500/40 bg-gradient-to-r from-rose-950/25 to-slate-950 text-xs space-y-2 shadow-sm"
              >
                <div className="flex items-center justify-between font-bold text-rose-300">
                  <span className="text-white font-bold">{anom.serviceId} &bull; {anom.metricName}</span>
                  <span className="font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-200 border border-rose-500/40 font-bold">
                    +{anom.zScore}&sigma; Spike
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed">{anom.rationale}</p>
                <div className="text-[10px] font-mono text-slate-400 p-2 rounded bg-slate-950 border border-slate-800/80">
                  Observed: <strong className="text-rose-300">{anom.observedValue}</strong> | Baseline: {anom.baselineMean} &plusmn; {anom.baselineStdDev}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
