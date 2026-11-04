# DataNova Campaign 08 — Product Architecture
**Deliverable** · *Unified System Design*

---

## 1. System Overview

DataNova connects declared architecture, infrastructure configuration, runtime observations, and operational evidence into a unified spatial architecture intelligence studio.

```
                              ┌────────────────────────────────────────┐
                              │         DATANOVA ORCHESTRATOR          │
                              │  (Unified Multi-Agent Coordination)    │
                              └──────────────────┬─────────────────────┘
                                                 │
          ┌──────────────────────────────────────┼──────────────────────────────────────┐
          │                                      │                                      │
┌─────────▼────────┐                   ┌─────────▼──────────┐                 ┌─────────▼────────┐
│       HOME       │                   │     WORKSPACE      │                 │EVIDENCE & REVIEW │
│                  │                   │                    │                 │                  │
│ • Product Story  │                   │ • Overview         │                 │ • Findings       │
│ • 4 Capabilities │                   │ • System Map       │                 │ • Sources        │
│ • My Projects    │                   │ • Analyze          │                 │ • Evidence       │
│ • Recent Actions │                   │ • Investigate      │                 │ • Reviews        │
│ • Start New Flow │                   │ • Improve&Compare  │                 │ • Share/Exchange │
│                  │                   │                    │                 │ • Quality/Bench  │
└──────────────────┘                   └────────────────────┘                 └──────────────────┘
```

---

## 2. Component Design & Directory Structure

```
apps/web/src/unified/
├── types.ts                      # Core shared contracts (Destinations, Projects, Reports)
├── DataNovaApp.tsx               # Top-level shell connecting the 3 destinations & orchestrator
├── header/
│   └── UnifiedHeader.tsx         # Universal top navigation bar, project selector, orchestrator trigger
├── orchestrator/
│   ├── orchestratorEngine.ts     # Pure deterministic multi-agent coordinator engine
│   └── OrchestratorModal.tsx     # Global modal with prompt, real execution timeline & unified report
├── home/
│   └── HomeView.tsx              # Welcoming landing experience, plain-language cards, recent activity
├── workspace/
│   ├── WorkspaceView.tsx         # Unified engineering workspace with 5 contextual subviews
│   ├── WorkspaceOverview.tsx     # Project status, summary cards, and quick actions
│   ├── WorkspaceSystemMap.tsx    # 3D spatial studio + 2D map + 8/10 layer modes + editor
│   ├── WorkspaceAnalyze.tsx      # Scenarios, simulations, queueing, SLOs, benchmarks
│   ├── WorkspaceInvestigate.tsx  # Reality engine, traces, drift triage, incidents, blast-radius
│   └── WorkspaceImprove.tsx      # Experiments, mutations, ADR decisions, release readiness
└── evidence/
    ├── EvidenceView.tsx          # Unified validation environment with 6 contextual subviews
    ├── FindingsSubView.tsx       # Cross-system findings ledger with evidence links
    ├── SourcesSubView.tsx        # Grounded literature and technical sources
    ├── EvidenceSubView.tsx       # Cryptographic telemetry envelopes and records
    ├── ReviewsSubView.tsx        # Reviewer room, assessments, validation policy
    ├── ExchangeSubView.tsx       # Package export/import with SHA-256 provenance
    └── QualitySubView.tsx        # Model benchmarks, validation coverage, limitations
```

---

## 3. Contextual Data Flow & Shared State

The active project and its canonical architecture model (`ArchitectureModel` from `src/lab/model.ts`) serve as the single source of truth across all views:

1. **System Map** renders the 3D scene from `activeProject.modelJson`.
2. **Analyze** runs load simulations against declared connections and capacities.
3. **Investigate** compares observed telemetry spans from `src/reality/` against the active model.
4. **Improve & Compare** creates proposed architecture mutations and tests release readiness.
5. **Evidence & Review** links all findings and reviews to the exact version of the architecture.
6. **Orchestrator** reads and mutates the active model when approved by the human engineer.
