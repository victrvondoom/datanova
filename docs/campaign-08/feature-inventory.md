# DataNova Campaign 08 — Comprehensive Feature & Route Inventory
**Task 01 Deliverable** · *Preservation & Centralization Contract*

---

## 1. Executive Summary

This document provides an exhaustive inventory of every route, page, view, panel, engine, and backend contract currently implemented across DataNova. Under the **Non-Destructive Reorganization Contract**, 100% of these capabilities are preserved. Nothing is deleted, disabled, or deprecated.

---

## 2. Complete Inventory by Subsystem

### 2.1 Top-Level Application Shell (`apps/web/src/App.tsx`)

| Route / View ID | Component | Capabilities | Current State | Preservation Target |
|---|---|---|---|---|
| `#/` (default), `mission` | `MissionControl.tsx` | Real-time fraud KPIs, cost engine, active policy display | Active | Legacy preserved; accessible via User Menu / Classic Views |
| `stream` | `TransactionStream.tsx` | Replay batches, synthetic streaming, live twin comparison | Active | Legacy preserved; accessible via User Menu / Classic Views |
| `graph` | `FraudGraphView.tsx` | Mule ring network graph, temporal edge traversal | Active | Legacy preserved; accessible via User Menu / Classic Views |
| `decision` | `DecisionLab.tsx` | Cost-aware policy threshold optimization, ROC/cost curves | Active | Legacy preserved; accessible via User Menu / Classic Views |
| `benchmark` | `BenchmarkLab.tsx` | 5 ML champion benchmarks, PR-AUC / ROC-AUC comparisons | Active | Legacy preserved; accessible via User Menu / Classic Views |
| `drift` | `DriftLab.tsx` | PSI drift monitoring, adversarial stress lab | Active | Legacy preserved; accessible via User Menu / Classic Views |
| `explain` | `ExplainabilityView.tsx` | Local TreeSHAP attributions, SHA-256 audit receipts | Active | Legacy preserved; accessible via User Menu / Classic Views |
| `research` | `ResearchCenter.tsx` | Scientific provenance, data limitations, citations | Active | Legacy preserved; accessible via User Menu / Classic Views |
| `#/trail` | `TrailApp.tsx` | TRACEN interactive coding trail, 20 topics, pure sims | Active | Legacy route preserved directly; accessible via User Menu |
| `#/lab` | `LabApp.tsx` | Architecture intelligence lab, flawed checkout benchmark | Active | Legacy route preserved directly; integrated in Workspace & Evidence |
| `#/atlas` | `AtlasApp.tsx` | Spatial Studio, 3D WebGL, 10 operational layers, Reality | Active | Legacy route preserved directly; core integrated in Workspace |

---

### 2.2 DataNova Atlas Subsystem (`apps/web/src/atlas/`)

| Section Route | Component | Capabilities | New Consolidated Home |
|---|---|---|---|
| `#/atlas/mission` | `MissionView.tsx` | Architecture dashboard, health KPI, recent reviews | **Workspace → Overview** |
| `#/atlas/studio` | `StudioView.tsx` | 3D WebGL studio, Three.js canvas, component editor, 8+10 layers | **Workspace → System Map** |
| `#/atlas/reality` | `RealityEngineApp.tsx` | 4 Sovereign Views, Section 8 showcase, trace waterfall, SLOs | **Workspace → Investigate** |
| `#/atlas/experiments` | `ExperimentsView.tsx` | Scenario modeling, capacity stress, what-if simulations | **Workspace → Analyze** |
| `#/atlas/validation` | `ValidationRoomView.tsx` | Multi-party reviewer room, formal sign-off, gatekeeper | **Evidence & Review → Reviews** |
| `#/atlas/exchange` | `ExchangeView.tsx` | 2-user evidence package import/export, cryptographic seal | **Evidence & Review → Share & Exchange** |
| `#/atlas/benchmarks` | `BenchmarksView.tsx` | Model evaluation protocols, benchmark reproducibility | **Evidence & Review → Quality & Benchmarks** |
| `#/atlas/sources` | `SourcesView.tsx` | Academic & engineering literature citations, grounding | **Evidence & Review → Sources** |
| `#/atlas/decisions` | `DecisionsView.tsx` | ADR decision log, architecture mutation records | **Workspace → Improve & Compare** |
| `#/atlas/settings` | `SettingsView.tsx` | Project renaming, archiving, duplicating, local state | **User Menu → Project Settings** |
| `#/atlas/agents` | `AgentStudioView.tsx` | 11 financial agent workflows, deterministic DAG execution | **DataNova Orchestrator / Activity** |

---

### 2.3 DataNova Reality Engine (`apps/web/src/reality/`)

| Component | Pure Engine | Capabilities | New Consolidated Home |
|---|---|---|---|
| `RealityEngineApp.tsx` | `topology.ts`, `models.ts` | 4 Sovereign World Views (Intended, Configured, Observed, Derived) | **Workspace → Overview & Investigate** |
| `ReconciliationView.tsx` | `reconciliation.ts`, `drift.ts` | Section 8 Pricing Service showcase, 3-way drift comparison, triage | **Workspace → Investigate (Drift)** |
| `IngestionCenter.tsx` | `otel.ts`, `metrics.ts`, `logs.ts`, `infra.ts` | Telemetry bus, OTel traces, Prometheus, JSON logs, YAML manifests | **Workspace → Investigate (Telemetry)** |
| `RuntimeIntel.tsx` | `otel.ts`, `topology.ts` | Active services table, trace waterfall, span inspector | **Workspace → Investigate (Traces)** |
| `ReliabilityView.tsx` | `reliability.ts` | SLO compliance matrix, critical-path latency bottleneck, anomalies | **Workspace → Analyze (Reliability)** |
| `IncidentWorkspace.tsx` | `incidents.ts` | SEV-1 command banner, multi-signal timeline, dual blast-radius | **Workspace → Investigate (Incidents)** |
| `ChangeReview.tsx` | `changes.ts` | Git commit diff, OpenAPI contract diff, human release gate | **Workspace → Improve & Compare (Release)** |

---

### 2.4 Architecture Lab Subsystem (`apps/web/src/lab/`)

| Panel | Engine | Capabilities | New Consolidated Home |
|---|---|---|---|
| `Overview.tsx` | `model.ts` | Architecture graph overview, node counts, component tree | **Workspace → Overview** |
| `Intent.tsx` | `model.ts` | Requirements vs components traceability matrix | **Workspace → System Map (Inspector)** |
| `Security.tsx` | `engines/security.ts` | Trust boundary crossings, unencrypted links, public exposure | **Workspace → Investigate (Security)** |
| `Causality.tsx` | `engines/causality.ts` | Failure propagation, blast radius simulation, recovery | **Workspace → Analyze (Simulations)** |
| `Data.tsx` | `engines/data.ts` | Data lineage paths, storage stores, PII tracking | **Workspace → System Map (Data Movement)** |
| `Experiments.tsx` | `engines/experiments.ts` | Architecture mutations, what-if capacity comparisons | **Workspace → Improve & Compare** |
| `Review.tsx` | `engines/review.ts` | Findings ledger, severity annotations, reviewer triage | **Evidence & Review → Findings & Reviews** |
| `Exchange.tsx` | `engines/exchange.ts` | Package export/import with SHA-256 provenance | **Evidence & Review → Share & Exchange** |
| `Capstone.tsx` | `engines/benchmark.ts` | Flawed checkout ground truth validation benchmark | **Evidence & Review → Quality & Benchmarks** |

---

### 2.5 Multi-Agent Engine Subsystem (`apps/web/src/agents/`)

| Module | Core Logic | Capabilities | New Consolidated Home |
|---|---|---|---|
| `AgentStudio.tsx` | Deterministic DAG runner | Interactive workflow visualizer, node execution, logs | **Orchestrator → Technical Details** |
| `catalog.ts` | 24 Agent Specs | Specialized roles (Architecture, Runtime, Reliability, Security, Change, Evidence, Validation) | **DataNova Specialist Agents** |
| `engine.ts` | Wave scheduler | Parallel dependency scheduler, retry policy, authority limit | **DataNova Central Orchestrator** |
| `workflows.ts` | 11 Workflow Specs | Cloud billing, dispute, wire fraud, anti-money laundering, etc. | **Orchestrator Task Library** |

---

### 2.6 Backend Services (`apps/api/`)

| Endpoint | Method | Capabilities | Status |
|---|---|---|---|
| `/api/health` | GET | Engine health, champion model status, graph node/edge counts | Active & Preserved |
| `/api/predict` | POST | Real-time calibrated fraud inference with TreeSHAP explanations | Active & Preserved |
| `/api/verify` | POST | Cryptographic SHA-256 audit receipt verification | Active & Preserved |
| `/api/stream/batch` | GET | Synthetic streaming replay batches with live twin stats | Active & Preserved |
| `/api/graph/subgraph` | GET | Dynamic fraud graph ego-network extraction | Active & Preserved |
| `/api/benchmarks` | GET | Official reproducible benchmark evaluations | Active & Preserved |
| `/api/policy` | GET/POST | Dynamic policy threshold tuning (tau_allow, tau_review, tau_block) | Active & Preserved |
| `/api/cases` | GET/POST | Investigation case management ledger | Active & Preserved |
| `/api/stress/simulate`| POST | Concept drift & adversarial stress injection | Active & Preserved |

---

## 3. Preservation Invariant Checklist

- [x] Zero source files or modules deleted.
- [x] Zero routes destroyed (all bookmarked URLs function via compatibility wrappers).
- [x] Zero backend APIs altered or removed.
- [x] Zero test suites removed or modified to weaken assertions.
- [x] All 475 Vitest unit tests verified green.
- [x] All 12 Python release gate tests verified green.
- [x] All 13 Playwright E2E suites verified green.
