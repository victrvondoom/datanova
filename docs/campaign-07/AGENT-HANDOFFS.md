# Campaign 07 — DataNova Reality Engine: Agent Handoffs & Boundary Contracts

## 1. Specialist Agent Matrix & File Boundaries

| Agent Persona | Role | Primary File Scope | Forbidden Actions |
|---|---|---|---|
| **Agent 1: Principal Architect** | Principal Architecture & Integration | `apps/web/src/reality/models.ts`, `history.ts`, `apps/web/src/atlas/AtlasApp.tsx` | Delegating final integration ownership |
| **Agent 2: Telemetry Ingestion** | OpenTelemetry & Observability | `apps/web/src/reality/connectors/otel.ts`, `metrics.ts`, `logs.ts`, `envelope.ts` | Modifying 3D shaders or layout logic |
| **Agent 3: Infra Discovery** | Infrastructure Discovery Engineer | `apps/web/src/reality/connectors/infra.ts` (K8s, Compose, Terraform) | Shell command execution or cluster mutations |
| **Agent 4: Runtime Graph** | Runtime Graph & Reconciliation | `apps/web/src/reality/identity.ts`, `reconciliation.ts`, `drift.ts` | Silently collapsing distinct views into single graph |
| **Agent 5: Spatial Visualizer** | Spatial Reality Visualization | `apps/web/src/atlas/scene.ts`, `layers.ts`, `apps/web/src/reality/ui/` | Modifying pure analytical engines or schemas |
| **Agent 6: Reliability Engineer** | Reliability & Incident Intelligence | `apps/web/src/reality/reliability.ts`, `incidents.ts` | Fabricating false AI certainty or synthetic health |
| **Agent 7: Change Intelligence** | Change Impact & Release Gates | `apps/web/src/reality/changes.ts` | Executing deployments or mutating production |
| **Agent 8: Adversarial QA** | Security, Falsification & QA | `apps/web/e2e/reality-*.spec.ts`, `src/reality/__tests__/` | Approving features without independent verification |

---

## 2. Handoff Protocol & Integration Order

1. **Step 1:** Agent 1 & Agent 2 establish `envelope.ts`, `models.ts`, and `governance.ts`.
2. **Step 2:** Agent 2 & Agent 3 implement connector parsers (`otel.ts`, `metrics.ts`, `logs.ts`, `infra.ts`).
3. **Step 3:** Agent 4 implements `identity.ts`, `topology.ts`, and `reconciliation.ts`.
4. **Step 4:** Agent 6 implements `reliability.ts` and `incidents.ts`.
5. **Step 5:** Agent 7 implements `changes.ts` (Git, OpenAPI, Terraform).
6. **Step 6:** Agent 5 & Agent 1 integrate the Reality Engine workspace and the 10 operational map layers in Atlas Studio.
7. **Step 7:** Agent 8 executes the 40-step Capstone journey via Playwright and conducts adversarial falsification.
