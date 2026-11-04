# Agent 1 Report: Repository Audit & Architecture Mapping

**Author:** Repository Archaeologist (`repo-architect`)  
**Scope:** Full-repository analysis across Campaigns 01–06, backend packages, frontend products, analytical engines, schemas, and test suites.

---

## 1. Executive Summary & Repository Structure

Datanova is a unified payment fraud detection and architecture intelligence platform. The repository is partitioned into two major layers:
1. **Python Data Science & Production Backend (`packages/`, `apps/api`, `scripts/`):**
   - Strictly zero-lookahead chronological dataset splitting (`ChronologicalSplitter`).
   - Feature engineering with directed graph ego-nets (`temporal.py`, `graph_features.py`).
   - Champion ML models: XGBoost (champion selected on validation PR-AUC 0.8111), LightGBM + Graph (0.7798), Random Forest, Logistic Regression.
   - Cost-aware policy optimization and TreeSHAP HMAC SHA-256 explainability receipts.
   - FastAPI server (`apps/api/main.py`) serving health checks, transactions, scoring, explainability, receipts, and benchmarks.
2. **TypeScript / React Frontend Workstation (`apps/web/`):**
   - Operations Dashboard (`src/views/`): Mission Control, Transaction Stream, Fraud Graph, Decision Lab, Benchmark Lab, Drift Lab, Explainability, Research Center.
   - TRACEN Vibe Coding Trail (`src/trail/`): 20-topic interactive learning trail with pure simulation logic (`sims/logic.ts`).
   - Architecture Intelligence Lab (`src/lab/`): Canonical architecture model (`model.ts`), analytical engines (`critic`, `scenario`, `blastradius`, `recovery-timeline`, `flightrecorder`, `benchmark`), and panels.
   - Datanova Atlas (`src/atlas/`): The spatial architecture engineering studio centered on Three.js WebGL rendering, 8 analytical map modes, and independent validation.

---

## 2. Inventory of Reusable Engines and Models

| Engine Module | Path | Capabilities & Reusability |
|---|---|---|
| **Canonical Model** | `src/lab/model.ts` | Complete IR defining components, connections, zones, requirements, operations, configurations, and model diffing. |
| **Critic Engine** | `src/lab/engines/critic.ts` | 14 rule checks identifying SPOFs, unbuffered writes, unauthenticated external access, trust boundary violations, and latency hazards. |
| **Scenario Engine** | `src/lab/engines/scenario.ts` | Deterministic simulation of workload ramps, bursts, component saturations, and expectation checks. |
| **Blast Radius** | `src/lab/engines/blastradius.ts` | Causal cascade analysis computing component failure propagation (down/degraded) and impacted operations. |
| **Recovery Timeline** | `src/lab/engines/recovery-timeline.ts` | Multistage recovery tracking (detect -> restart -> warmup -> healthy) and bottleneck identification. |
| **Flight Recorder** | `src/lab/engines/flightrecorder.ts` | Time-series event logging capturing component states, rps, latencies, and drops during simulation runs. |
| **Evidence & DEP** | `src/lab/engines/dep.ts` | Deterministic Evidence Package serialization, signing, integrity verification, and reconciliation. |

---

## 3. Dependency Inventory

- `three: ^0.171.0` & `@types/three: ^0.171.0`: Native WebGL rendering engine, OrbitControls, BufferGeometry, Shader/Material management.
- `lucide-react: ^1.62.0`: Standardized iconography.
- `recharts: ^3.10.1`: Time-series, latency histograms, and distribution charts.
- `react: ^19.3.1` & `react-dom: ^19.3.1`: Modern React runtime.
- `tailwindcss: ^3.4.17`: Utility styling with custom design tokens.

---

## 4. Current Deficiencies & Upgrade Opportunities

1. **Spatial Drag Interaction:** While `layout.ts` contains `applyUserLayout`, the WebGL pointer events in `scene.ts` do not yet handle mouse drag for moving nodes interactively in the 3D plane.
2. **Edge Inspection & Editing:** In `Studio.tsx`, selecting an edge opens the inspector, but properties like criticality, kind (sync/async), failure behavior (blocks/fails-open), and latency SLA cannot be edited inline.
3. **Component Grouping:** The navigator groups by zone, but arbitrary custom user grouping is not yet provided.
4. **Simulation Time Scrubber:** Flight recorder events exist in the engine, but the studio UI only reflects the scenario's peak state without a time scrubber to inspect progression across steps.
5. **Atlas DEP Exchange Journey:** Reuses the lab Exchange panel, but needs an end-to-end two-context reviewer round trip test specifically within the Atlas shell.

Agent 1 certifies this baseline as stable and ready for targeted implementation.

