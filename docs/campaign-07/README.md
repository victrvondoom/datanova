# DataNova Reality Engine — Campaign 07

**Product:** DataNova Reality Engine  
**Mission:** Transform DataNova from a system-design and spatial architecture studio into an evidence-driven platform that can discover, reconstruct, compare, and investigate the difference between intended architecture and observed operational reality.

---

## 1. Core Principles

The Reality Engine maintains four distinct, uncollapsed views of reality:

| View | Meaning | Example |
|---|---|---|
| **Intended** | What the architecture says should exist | API Gateway → Order Queue → Order Worker |
| **Configured** | What infrastructure and deployment artifacts declare | Kubernetes Deployment & Service manifests |
| **Observed** | What runtime evidence actually demonstrates | Distributed traces reveal API Gateway → Pricing Service |
| **Derived** | What the reconciliation engine concludes | Undocumented dependency detected (CONFIRMED) |

Every conclusion carries:
- Evidence source & type
- Observation timestamp & validity interval
- Confidence / matching status (`CONFIRMED`, `SUPPORTED`, `INFERRED`, `AMBIGUOUS`, `CONFLICTING`, `STALE`, `MISSING_EVIDENCE`, `SYNTHETIC_ONLY`)
- Data-quality limitations
- Provenance trail & underlying raw record inspection

---

## 2. Directory Index

- [`MASTER-PLAN.md`](./MASTER-PLAN.md) — 40-task execution plan & work package breakdown
- [`EXECUTION-STATE.md`](./EXECUTION-STATE.md) — Live milestone progress and system ledger
- [`AGENT-HANDOFFS.md`](./AGENT-HANDOFFS.md) — Specialist agent roles, boundaries, and handoff contracts
- [`architecture.md`](./architecture.md) — System architecture, data flow, and module boundaries
- [`evidence-model.md`](./evidence-model.md) — Operational Evidence Envelope and relationship specifications
- [`connector-specification.md`](./connector-specification.md) — OTel, Prometheus, Logs, K8s/Terraform connector protocols
- [`reconciliation-specification.md`](./reconciliation-specification.md) — Three-way reconciliation algorithm and drift taxonomy
- [`runtime-map-specification.md`](./runtime-map-specification.md) — 10 operational layers in 3D Studio and 2D fallback
- [`incident-intelligence-specification.md`](./incident-intelligence-specification.md) — Incident timeline and causal reasoning engine
- [`security-review.md`](./security-review.md) — Read-only boundaries, redaction, and workspace isolation
- [`VERIFICATION-INDEX.md`](./VERIFICATION-INDEX.md) — Test matrix, Playwright E2E results, and benchmarks
- [`known-limitations.md`](./known-limitations.md) — Honest boundaries, synthetic labels, and future work
- [`FINAL-REPORT.md`](./FINAL-REPORT.md) — Final Campaign 07 delivery report
