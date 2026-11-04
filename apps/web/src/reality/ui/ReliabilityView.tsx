/**
 * Campaign 07 — Tasks 21–25: Reliability, SLOs & Anomaly Intelligence UI
 *
 * Visualizes SLO compliance, error budget burn rates, critical-path latency
 * bottlenecks, saturation indicators, and statistical anomaly alerts.
 */

import React, { useMemo } from "react";
import {
  Zap, Clock, TrendingUp, ShieldCheck
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
      <div>
        <h2 className="text-lg font-bold text-white">Operational Reliability & SLO Intelligence</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Real-time SLI/SLO evaluation, error budget consumption, critical path request tracing, and statistical anomaly detection.
        </p>
      </div>

      {/* Holistic Operational Scorecard */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Operational Reliability Scorecard</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Composite Score:</span>
            <span className={`text-xl font-black font-mono ${scorecard.overallScore >= 80 ? "text-emerald-400" : "text-amber-400"}`}>
              {scorecard.overallScore} / 100
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {Object.entries(scorecard.dimensions).map(([key, dim]) => (
            <div key={key} className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="capitalize font-medium text-slate-300">{key}</span>
                <span className={`font-mono font-bold ${dim.status === "good" ? "text-emerald-400" : "text-amber-400"}`}>
                  {dim.score}%
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{dim.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* SLO Explorer Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Zap size={16} className="text-sky-400" />
            <span>Service SLO Compliance ({sloEvaluations.length} Services)</span>
          </h3>
          <span className="text-xs text-slate-400">Burn rate &gt;1.0 indicates elevated risk</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
              <tr>
                <th className="py-2 px-3">Service</th>
                <th className="py-2 px-3">Availability SLI</th>
                <th className="py-2 px-3">Latency SLI</th>
                <th className="py-2 px-3">Error Budget</th>
                <th className="py-2 px-3">Burn Rate</th>
                <th className="py-2 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {sloEvaluations.map((slo) => (
                <tr key={slo.serviceId} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2 px-3 font-semibold text-white">{slo.name}</td>
                  <td className="py-2 px-3 font-mono">
                    <span className={slo.availabilityMet ? "text-emerald-400" : "text-rose-400"}>
                      {(slo.availabilitySli * 100).toFixed(2)}%
                    </span>
                  </td>
                  <td className="py-2 px-3 font-mono">
                    <span className={slo.latencyMet ? "text-emerald-400" : "text-amber-400"}>
                      {(slo.latencySli * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2 px-3 font-mono">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-400 h-full rounded-full"
                          style={{ width: `${Math.round(slo.errorBudgetRemaining * 100)}%` }}
                        />
                      </div>
                      <span>{(slo.errorBudgetRemaining * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="py-2 px-3 font-mono font-bold text-sky-400">{slo.burnRate}x</td>
                  <td className="py-2 px-3 text-right">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        slo.status === "healthy"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : slo.status === "warning"
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-rose-500/20 text-rose-300"
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
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock size={16} className="text-amber-400" />
              <span>Critical-Path Latency Analysis</span>
            </h3>
            {criticalPath && (
              <span className="text-xs font-mono text-amber-300 font-bold">
                Total: {criticalPath.totalDurationMs} ms
              </span>
            )}
          </div>

          {criticalPath ? (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
                Primary Bottleneck: <strong>{criticalPath.bottleneckService}</strong> contributes{" "}
                <strong>{criticalPath.bottleneckContributionPercentage}%</strong> of total request duration.
              </div>

              <div className="space-y-2">
                {criticalPath.segments.map((seg) => (
                  <div key={seg.spanId} className="p-2.5 rounded bg-slate-950 border border-slate-800 text-xs">
                    <div className="flex items-center justify-between font-semibold">
                      <span className={seg.isBottleneck ? "text-amber-300 font-bold" : "text-white"}>
                        {seg.serviceName} &bull; {seg.operationName}
                      </span>
                      <span className="font-mono text-slate-300">{seg.selfDurationMs} ms</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${seg.isBottleneck ? "bg-amber-400" : "bg-sky-400"}`}
                        style={{ width: `${Math.max(5, seg.percentageOfTrace)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500">No traces available for critical path calculation.</div>
          )}
        </div>

        {/* Statistical Anomalies */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp size={16} className="text-rose-400" />
              <span>Statistical Anomaly Alerts</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">Z-Score &gt; 2.5&sigma;</span>
          </div>

          <div className="space-y-2.5">
            {anomalies.map((anom, i) => (
              <div key={i} className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs space-y-1">
                <div className="flex items-center justify-between font-bold text-rose-300">
                  <span>{anom.serviceId} &bull; {anom.metricName}</span>
                  <span className="font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-200">
                    +{anom.zScore}&sigma; Spike
                  </span>
                </div>
                <p className="text-rose-200">{anom.rationale}</p>
                <div className="text-[10px] font-mono text-slate-400">
                  Observed: {anom.observedValue} | Baseline: {anom.baselineMean} &plusmn; {anom.baselineStdDev}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
