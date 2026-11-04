/**
 * Campaign 07 — Tasks 21–25: Operational Reliability, SLOs & Anomaly Intelligence
 *
 * Implements SLI/SLO evaluations, error budget burn rates, critical-path latency
 * analysis, saturation bottleneck detection, and statistical anomaly detection.
 */

import type { NormalizedSpan } from "./connectors/otel";

export interface ServiceSloConfig {
  serviceId: string;
  name: string;
  availabilityTarget: number; // e.g. 0.999 (99.9%)
  latencyTargetMs: number;    // e.g. 100ms
  latencyRatioTarget: number; // e.g. 0.95 (95% <= 100ms)
  evaluationWindowHours: number;
}

export interface ServiceSloEvaluation {
  serviceId: string;
  name: string;
  totalRequests: number;
  successfulRequests: number;
  availabilitySli: number;
  availabilityMet: boolean;
  latencyRequestsUnderTarget: number;
  latencySli: number;
  latencyMet: boolean;
  errorBudgetRemaining: number; // percentage (0.0 - 1.0)
  burnRate: number; // 1.0 = normal burn rate, >1.0 = burning faster than allowed
  status: "healthy" | "warning" | "breached";
}

export interface CriticalPathSegment {
  spanId: string;
  serviceName: string;
  operationName: string;
  selfDurationMs: number;
  totalDurationMs: number;
  percentageOfTrace: number;
  isBottleneck: boolean;
}

export interface CriticalPathAnalysis {
  traceId: string;
  rootService: string;
  totalDurationMs: number;
  segments: CriticalPathSegment[];
  bottleneckService: string;
  bottleneckContributionPercentage: number;
}

export interface SaturationSignal {
  serviceId: string;
  metric: "queue_depth" | "cpu_utilization" | "memory_utilization" | "thread_pool_active" | "request_rate";
  value: number;
  threshold: number;
  unit: string;
  isSaturated: boolean;
  consequences: string;
}

export interface AnomalyFinding {
  serviceId: string;
  metricName: string;
  observedValue: number;
  baselineMean: number;
  baselineStdDev: number;
  zScore: number;
  severity: "critical" | "warning" | "info";
  direction: "spike" | "drop";
  rationale: string;
  timestampIso: string;
}

export interface OperationalScorecard {
  overallScore: number; // 0 - 100
  dimensions: {
    availability: { score: number; status: "good" | "warn" | "poor"; detail: string };
    latency: { score: number; status: "good" | "warn" | "poor"; detail: string };
    errorBehavior: { score: number; status: "good" | "warn" | "poor"; detail: string };
    drift: { score: number; status: "good" | "warn" | "poor"; detail: string };
    coverage: { score: number; status: "good" | "warn" | "poor"; detail: string };
  };
  hasMissingEvidence: boolean;
  summary: string;
}

export class ReliabilityEngine {
  /** Evaluate SLI/SLO performance from spans */
  public evaluateSlos(
    spans: NormalizedSpan[],
    configs: ServiceSloConfig[]
  ): ServiceSloEvaluation[] {
    const results: ServiceSloEvaluation[] = [];

    // Group spans by service
    const serviceSpans = new Map<string, NormalizedSpan[]>();
    for (const s of spans) {
      const list = serviceSpans.get(s.serviceName) || [];
      list.push(s);
      serviceSpans.set(s.serviceName, list);
    }

    for (const cfg of configs) {
      const spansForService = serviceSpans.get(cfg.serviceId) || serviceSpans.get(cfg.name) || [];
      const total = spansForService.length;

      if (total === 0) {
        results.push({
          serviceId: cfg.serviceId,
          name: cfg.name,
          totalRequests: 0,
          successfulRequests: 0,
          availabilitySli: 1.0,
          availabilityMet: true,
          latencyRequestsUnderTarget: 0,
          latencySli: 1.0,
          latencyMet: true,
          errorBudgetRemaining: 1.0,
          burnRate: 0.0,
          status: "healthy",
        });
        continue;
      }

      const successful = spansForService.filter((s) => s.statusCode !== "ERROR").length;
      const availabilitySli = successful / total;
      const availabilityMet = availabilitySli >= cfg.availabilityTarget;

      const latencyUnder = spansForService.filter((s) => s.durationMs <= cfg.latencyTargetMs).length;
      const latencySli = latencyUnder / total;
      const latencyMet = latencySli >= cfg.latencyRatioTarget;

      // Error budget math: allowed error rate = 1 - availabilityTarget
      const allowedErrorRate = 1 - cfg.availabilityTarget;
      const observedErrorRate = 1 - availabilitySli;
      const burnRate = allowedErrorRate > 0 ? observedErrorRate / allowedErrorRate : 1.0;
      const errorBudgetRemaining = Math.max(0, 1 - burnRate * 0.1);

      let status: ServiceSloEvaluation["status"] = "healthy";
      if (!availabilityMet || !latencyMet) {
        status = "breached";
      } else if (burnRate > 1.5 || errorBudgetRemaining < 0.3) {
        status = "warning";
      }

      results.push({
        serviceId: cfg.serviceId,
        name: cfg.name,
        totalRequests: total,
        successfulRequests: successful,
        availabilitySli: Math.round(availabilitySli * 10000) / 10000,
        availabilityMet,
        latencyRequestsUnderTarget: latencyUnder,
        latencySli: Math.round(latencySli * 10000) / 10000,
        latencyMet,
        errorBudgetRemaining: Math.round(errorBudgetRemaining * 100) / 100,
        burnRate: Math.round(burnRate * 100) / 100,
        status,
      });
    }

    return results;
  }

  /** Compute critical-path request latency without double counting parallel execution */
  public calculateCriticalPath(spans: NormalizedSpan[]): CriticalPathAnalysis | null {
    if (spans.length === 0) return null;

    // Find root span (no parentSpanId or parent not in trace)
    const spanIds = new Set(spans.map((s) => s.spanId));
    const rootSpan = spans.find((s) => !s.parentSpanId || !spanIds.has(s.parentSpanId)) || spans[0];

    // Build children map
    const childrenMap = new Map<string, NormalizedSpan[]>();
    for (const s of spans) {
      if (s.parentSpanId) {
        const list = childrenMap.get(s.parentSpanId) || [];
        list.push(s);
        childrenMap.set(s.parentSpanId, list);
      }
    }

    const segments: CriticalPathSegment[] = [];
    const totalDurationMs = Math.max(1, rootSpan.durationMs);

    for (const span of spans) {
      const children = childrenMap.get(span.spanId) || [];
      const childrenDuration = children.reduce((sum, c) => sum + c.durationMs, 0);
      // Self duration = duration minus direct children execution (avoid negative numbers)
      const selfDurationMs = Math.max(0.1, span.durationMs - Math.min(span.durationMs, childrenDuration));
      const percentageOfTrace = Math.round((selfDurationMs / totalDurationMs) * 100);

      segments.push({
        spanId: span.spanId,
        serviceName: span.serviceName,
        operationName: span.name,
        selfDurationMs: Math.round(selfDurationMs * 10) / 10,
        totalDurationMs: Math.round(span.durationMs * 10) / 10,
        percentageOfTrace,
        isBottleneck: false,
      });
    }

    // Identify bottleneck segment with highest self-duration
    segments.sort((a, b) => b.selfDurationMs - a.selfDurationMs);
    if (segments.length > 0) {
      segments[0].isBottleneck = true;
    }

    const bottleneck = segments[0] || { serviceName: rootSpan.serviceName, percentageOfTrace: 0 };

    return {
      traceId: rootSpan.traceId,
      rootService: rootSpan.serviceName,
      totalDurationMs: Math.round(totalDurationMs * 10) / 10,
      segments,
      bottleneckService: bottleneck.serviceName,
      bottleneckContributionPercentage: bottleneck.percentageOfTrace,
    };
  }

  /** Detect statistical anomalies using Z-score */
  public detectAnomalies(
    currentMetrics: Array<{ serviceId: string; metricName: string; value: number }>,
    historicalBaselines: Record<string, { mean: number; stdDev: number }>
  ): AnomalyFinding[] {
    const findings: AnomalyFinding[] = [];
    const nowIso = new Date().toISOString();

    for (const item of currentMetrics) {
      const key = `${item.serviceId}:${item.metricName}`;
      const baseline = historicalBaselines[key];
      if (!baseline || baseline.stdDev <= 0) continue;

      const zScore = (item.value - baseline.mean) / baseline.stdDev;
      const absZ = Math.abs(zScore);

      if (absZ >= 2.5) {
        const severity: AnomalyFinding["severity"] = absZ >= 4.0 ? "critical" : "warning";
        const direction: AnomalyFinding["direction"] = zScore > 0 ? "spike" : "drop";

        findings.push({
          serviceId: item.serviceId,
          metricName: item.metricName,
          observedValue: Math.round(item.value * 100) / 100,
          baselineMean: Math.round(baseline.mean * 100) / 100,
          baselineStdDev: Math.round(baseline.stdDev * 100) / 100,
          zScore: Math.round(zScore * 100) / 100,
          severity,
          direction,
          rationale: `Metric "${item.metricName}" deviated by ${zScore.toFixed(1)}σ from baseline mean of ${baseline.mean.toFixed(1)}`,
          timestampIso: nowIso,
        });
      }
    }

    return findings;
  }

  /** Calculate holistic operational scorecard */
  public calculateScorecard(
    slos: ServiceSloEvaluation[],
    driftCount: number,
    coveragePercentage: number
  ): OperationalScorecard {
    const avgAvailability = slos.length > 0
      ? slos.reduce((sum, s) => sum + s.availabilitySli, 0) / slos.length
      : 1.0;
    const avgLatency = slos.length > 0
      ? slos.reduce((sum, s) => sum + s.latencySli, 0) / slos.length
      : 1.0;
    const errorCount = slos.reduce((sum, s) => sum + (s.totalRequests - s.successfulRequests), 0);

    const availScore = Math.round(avgAvailability * 100);
    const latencyScore = Math.round(avgLatency * 100);
    const errorScore = Math.max(0, 100 - errorCount * 5);
    const driftScore = Math.max(0, 100 - driftCount * 15);
    const coverageScore = coveragePercentage;

    const overallScore = Math.round((availScore + latencyScore + errorScore + driftScore + coverageScore) / 5);

    return {
      overallScore,
      dimensions: {
        availability: {
          score: availScore,
          status: availScore >= 99 ? "good" : availScore >= 95 ? "warn" : "poor",
          detail: `${(avgAvailability * 100).toFixed(2)}% availability across monitored services`,
        },
        latency: {
          score: latencyScore,
          status: latencyScore >= 95 ? "good" : latencyScore >= 85 ? "warn" : "poor",
          detail: `${(avgLatency * 100).toFixed(1)}% of requests meet latency SLA targets`,
        },
        errorBehavior: {
          score: errorScore,
          status: errorScore >= 95 ? "good" : errorScore >= 75 ? "warn" : "poor",
          detail: `${errorCount} error span(s) observed in active telemetry window`,
        },
        drift: {
          score: driftScore,
          status: driftScore >= 90 ? "good" : driftScore >= 60 ? "warn" : "poor",
          detail: `${driftCount} architectural drift finding(s) detected`,
        },
        coverage: {
          score: coverageScore,
          status: coverageScore >= 80 ? "good" : coverageScore >= 50 ? "warn" : "poor",
          detail: `${coverageScore}% of declared architecture components have active telemetry`,
        },
      },
      hasMissingEvidence: coveragePercentage < 70,
      summary: `System operational health score: ${overallScore}/100. ${driftCount > 0 ? `${driftCount} drift item(s) require review.` : "No critical drift detected."}`,
    };
  }
}
