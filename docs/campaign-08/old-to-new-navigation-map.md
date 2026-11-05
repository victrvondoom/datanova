# DataNova Campaign 08 — Old-to-New Navigation Mapping
**Task 03 Deliverable** · *Information Architecture Unification*

---

## 1. Unified Navigation Hierarchy

DataNova replaces dozens of fragmented dashboards with **exactly three primary destinations** and **one global Orchestrator**:

```
                       ┌─────────────────────────┐
                       │   DataNova Orchestrator │
                       └────────────┬────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
 ┌────────▼────────┐       ┌────────▼────────┐       ┌────────▼────────┐
 │      HOME       │       │    WORKSPACE    │       │EVIDENCE & REVIEW│
 └─────────────────┘       └────────┬────────┘       └────────┬────────┘
                                    │                         │
            ┌───────────────┬───────┴───────┬──────────────┐  │
            ▼               ▼               ▼              ▼  ▼
        Overview       System Map        Analyze      Investigate  Improve
            │                                                 │
            │          ┌────────────┬─────────────┬───────────┴──────────┐
            ▼          ▼            ▼             ▼           ▼          ▼
         Findings   Sources      Evidence      Reviews    Exchange    Quality
```

---

## 2. Comprehensive Old-to-New Mapping Matrix

| Legacy Destination / URL | Old Subsystem | New Unified Destination | Unified Subview | Contextual Access Path |
|---|---|---|---|---|
| `#/` | Root | **Home** | `#/home` | Direct primary navigation tab: **Home** |
| `#/mission` | Ops Lab | **Workspace** | `#/workspace/overview` | Primary navigation tab: **Workspace → Overview** |
| `#/atlas/mission` | Atlas Shell | **Workspace** | `#/workspace/overview` | Primary navigation tab: **Workspace → Overview** |
| `#/lab/overview` | Lab Shell | **Workspace** | `#/workspace/overview` | Primary navigation tab: **Workspace → Overview** |
| `#/atlas/studio` | Atlas 3D | **Workspace** | `#/workspace/map` | Primary navigation tab: **Workspace → System Map** |
| `#/atlas/studio?mode=structure` | Atlas Layer | **Workspace** | `#/workspace/map?layer=structure` | System Map: "System structure" layer |
| `#/atlas/studio?mode=dependencies`| Atlas Layer | **Workspace** | `#/workspace/map?layer=connections` | System Map: "Connections" layer |
| `#/atlas/studio?mode=traffic` | Atlas Layer | **Workspace** | `#/workspace/map?layer=traffic` | System Map: "Traffic" layer |
| `#/atlas/studio?mode=security` | Atlas Layer | **Workspace** | `#/workspace/map?layer=security` | System Map: "Security boundaries" layer |
| `#/atlas/studio?mode=data` | Atlas Layer | **Workspace** | `#/workspace/map?layer=data` | System Map: "Data movement" layer |
| `#/atlas/studio?mode=failure` | Atlas Layer | **Workspace** | `#/workspace/map?layer=failure` | System Map: "What can fail" layer |
| `#/atlas/studio?mode=recovery` | Atlas Layer | **Workspace** | `#/workspace/map?layer=recovery` | System Map: "How recovery works" layer |
| `#/atlas/studio?mode=evidence` | Atlas Layer | **Workspace** | `#/workspace/map?layer=evidence` | System Map: "Supporting evidence" layer |
| `#/atlas/experiments` | Atlas Shell | **Workspace** | `#/workspace/analyze` | Primary navigation tab: **Workspace → Analyze** |
| `#/decision` | Decision Lab | **Workspace** | `#/workspace/analyze` | Workspace → Analyze (Policy Tuning) |
| `#/drift` | Stress Lab | **Workspace** | `#/workspace/analyze` | Workspace → Analyze (Drift Stress) |
| `#/atlas/reality` | Reality Engine| **Workspace** | `#/workspace/investigate` | Primary navigation tab: **Workspace → Investigate** |
| `#/atlas/reality?tab=overview` | Reality Tab | **Workspace** | `#/workspace/investigate?sub=overview` | Investigate: Reconciled Topology Map |
| `#/atlas/reality?tab=reconcile`| Reality Tab | **Workspace** | `#/workspace/investigate?sub=drift` | Investigate: Section 8 Pricing Service Drift |
| `#/atlas/reality?tab=runtime` | Reality Tab | **Workspace** | `#/workspace/investigate?sub=traces` | Investigate: Trace Waterfall & Span Explorer |
| `#/atlas/reality?tab=reliability`| Reality Tab| **Workspace** | `#/workspace/analyze?sub=slos` | Analyze: SLO Compliance & Latency Bottlenecks |
| `#/atlas/reality?tab=incidents` | Reality Tab | **Workspace** | `#/workspace/investigate?sub=incidents`| Investigate: SEV-1 Incident Command |
| `#/atlas/reality?tab=changes` | Reality Tab | **Workspace** | `#/workspace/improve?sub=release` | Improve: Release Gate & Contract Diff |
| `#/atlas/decisions` | Atlas Shell | **Workspace** | `#/workspace/improve` | Primary navigation tab: **Workspace → Improve & Compare** |
| `#/lab/experiments` | Lab Panel | **Workspace** | `#/workspace/improve` | Improve & Compare: Counterfactual Mutations |
| `#/explain` | TreeSHAP | **Evidence & Review** | `#/evidence/findings` | Primary navigation tab: **Evidence & Review → Findings** |
| `#/lab/review` | Lab Panel | **Evidence & Review** | `#/evidence/findings` | Evidence & Review: Findings Ledger |
| `#/atlas/sources` | Atlas Shell | **Evidence & Review** | `#/evidence/sources` | Primary navigation tab: **Evidence & Review → Sources** |
| `#/research` | Literature | **Evidence & Review** | `#/evidence/sources` | Evidence & Review: Grounded Citations |
| `#/atlas/reality?tab=ingestion`| Reality Tab | **Evidence & Review** | `#/evidence/records` | Evidence & Review: Telemetry Envelopes |
| `#/atlas/validation` | Atlas Shell | **Evidence & Review** | `#/evidence/reviews` | Primary navigation tab: **Evidence & Review → Reviews** |
| `#/atlas/exchange` | Atlas Shell | **Evidence & Review** | `#/evidence/exchange` | Primary navigation tab: **Evidence & Review → Share & Exchange** |
| `#/lab/exchange` | Lab Panel | **Evidence & Review** | `#/evidence/exchange` | Share & Exchange: Package Import/Export |
| `#/atlas/benchmarks` | Atlas Shell | **Evidence & Review** | `#/evidence/quality` | Primary navigation tab: **Evidence & Review → Quality & Benchmarks** |
| `#/benchmark` | ML Benchmarks| **Evidence & Review** | `#/evidence/quality` | Quality & Benchmarks: Reproducible Metrics |
| `#/lab/capstone` | Ground Truth | **Evidence & Review** | `#/evidence/quality` | Quality & Benchmarks: Ground Truth Benchmarks |
| `#/atlas/agents` | Agent Studio | **DataNova Orchestrator**| Global Modal | Header "Ask Orchestrator" → Activity Details |
| `#/atlas/settings` | Atlas Shell | **User Menu** | Settings Modal | Top-right User Avatar → Settings |
| `#/trail` | Learning Trail| **User Menu / Deep Link**| `#/trail` | Top-right Menu → "TRACEN Learning Trail" |

---

## 3. URL Compatibility & Redirect Guarantees

Existing routes and bookmarks never break. The router handles both modern and legacy routes:

1. **Modern Routes:**
   - `#/home` &rarr; Loads Unified Home view.
   - `#/workspace` (and `#/workspace/:subview`) &rarr; Loads Unified Workspace with specified subview (`overview`, `map`, `analyze`, `investigate`, `improve`).
   - `#/evidence` (and `#/evidence/:subview`) &rarr; Loads Unified Evidence & Review with specified subview (`findings`, `sources`, `evidence`, `reviews`, `exchange`, `quality`).

2. **Legacy Deep-Links:**
   - `#/atlas/...` paths continue to function directly, or route into the equivalent Workspace/Evidence subview seamlessly.
   - `#/lab` paths continue to function directly.
   - `#/trail` paths continue to function directly.
   - Direct calls from existing tests (like `page.goto("/#/atlas/reality")`) remain 100% operational.

