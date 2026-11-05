# DataNova Campaign 08 — Central Multi-Agent Orchestrator
**Tasks 08–12 Deliverables** · *Unified Goal-Driven Intelligence*

---

## 1. Executive Summary

The **DataNova Orchestrator** is the single entry point where users describe what they want to understand, investigate, or improve. Users do not need to choose between separate technical dashboards or manually dispatch individual agents.

Instead, the user states a goal in plain English, and the Orchestrator plans, coordinates the appropriate specialist agents and deterministic engines, reconciles their outputs, and delivers one coherent, evidence-backed report.

---

## 2. The 6-Step Orchestration Lifecycle

```
[ User Request ]
       │
       ▼
┌─────────────────────────────────┐
│ 1. UNDERSTAND REQUEST           │  Extract intent, target components, active workspace,
│                                 │  version, existing evidence, and missing context.
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│ 2. BUILD EXECUTION PLAN         │  Determine genuinely necessary specialist agents & engines.
│                                 │  Display concise plain-language plan before execution.
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│ 3. COORDINATE SPECIALISTS       │  Dispatch tasks in parallel waves or sequential dependencies.
│                                 │  Maintain shared workspace context, prevent duplicate work.
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│ 4. RECONCILE RESULTS            │  Deduplicate findings, preserve legitimate disagreements,
│                                 │  distinguish direct evidence from inferences.
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│ 5. VERIFY                       │  Run deterministic schema validation, model consistency checks,
│                                 │  and provenance integrity hashes.
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│ 6. UNIFIED FINAL REPORT         │  One synthesized report: What was understood, examined,
│                                 │  found, why it matters, evidence links, and next actions.
└─────────────────────────────────┘
```

---

## 3. Specialist Agent Roles & Responsibilities

| Specialist Agent | Internal Capability & Responsibilities | Actual Implementation / Engine |
|---|---|---|
| **Architecture Specialist** | Inspects declared components, connections, zones, requirement IDs, and graph topology. | `packages/data/schemas.py`, `src/lab/model.ts`, `src/atlas/graph.ts` |
| **Runtime Specialist** | Reconstructs live service topology from traces, identifies undocumented dependencies and call volumes. | `src/reality/topology.ts`, `src/reality/connectors/otel.ts` |
| **Reliability Specialist** | Evaluates SLI/SLO compliance, error budget burn rates, critical path latency bottlenecks. | `src/reality/reliability.ts` |
| **Security Specialist** | Inspects trust boundary transitions, public network exposure, unencrypted data channels. | `src/lab/engines/security.ts` |
| **Change Impact Specialist**| Analyzes Git commits, OpenAPI contract breaking diffs, and release gate readiness policies. | `src/reality/changes.ts` |
| **Evidence Specialist** | Attests cryptographic evidence envelopes, validates SHA-256 hashes, checks data quality. | `src/reality/envelope.ts`, `src/reality/governance.ts` |
| **Validation Specialist** | Evaluates independent review requirements, multi-party sign-offs, and verification coverage. | `src/atlas/validation.ts`, `src/lab/engines/review.ts` |

---

## 4. Final Unified Report Schema

Every orchestration execution produces a structured report containing:

1. **User Goal Summary:** What the user requested in plain language.
2. **Investigation Scope:** Which project, architecture version, and components were examined.
3. **Key Findings:** Plain-language discoveries with severity badges (`Critical`, `Warning`, `Informational`).
4. **Why It Matters:** Operational, architectural, or business consequence of each finding.
5. **Supporting Evidence:** Clickable links to traces, spans, YAML manifests, or benchmark records.
6. **Uncertainties & Known Limitations:** Clear statements of what could not be determined or where evidence is modeled.
7. **Recommended Next Actions:** One-click actions to investigate deeper, accept a drift, adopt into architecture, or open a review.
8. **Technical Activity Drawer (Optional):** Expandable execution logs detailing specialist task assignments, durations, and tool outputs for advanced engineers.

