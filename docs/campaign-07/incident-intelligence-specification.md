# Campaign 07 — Operational Reliability & Incident Intelligence Specification

## 1. Reliability & SLO Architecture

- **Service Level Indicators (SLIs):**
  - Availability SLI: $\frac{\text{Successful Requests (2xx, 3xx, 4xx non-error)}}{\text{Total Requests}}$
  - Latency SLI: $\frac{\text{Requests with duration} \le \text{Threshold}}{\text{Total Requests}}$
- **Service Level Objectives (SLOs):** Target percentage (e.g. 99.9%) evaluated over a rolling time window.
- **Error Budget Consumption:** Calculated burn rates ($\frac{\text{Observed Error Rate}}{\text{Allowed Error Rate}}$) triggering warning and critical alerts.

---

## 2. Critical-Path Latency Intelligence

Distributed traces are analyzed using topological span ordering:
- Distinguishes sequential call time from parallel fan-out spans to prevent double-counting.
- Calculates per-span self-time vs child execution time.
- Highlights the bottleneck service contributing the highest percentage to overall user journey latency.

---

## 3. Incident Investigation & Causal Reasoning

The incident workspace provides an evidence-based investigation surface:
- **Correlated Event Timeline:** Merges traces, logs, metric alerts, deployment commits, and drift records into a single chronologically aligned timeline.
- **Causal Hypothesis Graph:**
  - Candidate Cause (e.g. "Pricing Service v1.4.0 deployment introduced unindexed query on Order DB").
  - Supporting Evidence (Trace `tr-001` latency spike at 14:02, Postgres CPU saturation metric at 14:03).
  - Contradicting Evidence (Network interface metrics showed normal packet rates).
  - Confidence Rating: `SUPPORTED` (explicitly disclaims absolute AI certainty).
- **Observed Blast Radius:** Calculates both the theoretical (Intended) and observed (Runtime) impacted downstream services.
- **Evidence-Backed Postmortem:** Generates an exportable DEP-compliant postmortem package with immutable cryptographic attestation.
