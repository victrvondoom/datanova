# Agent 4 Report: Architecture Graph & Synchronized Mapping Engine

**Author:** Architecture Graph & Mapping Engineer (`architecture-map-engineer`)  
**Scope:** Canonical IR mapping, graph adapter, 8 analytical map layers, and engine output integration.

---

## 1. Canonical Graph Adapter (`graph.ts`)

The adapter `toVisGraph(model: ArchitectureModel): VisGraph` translates the canonical intermediate representation into an optimized visualization graph without loss of semantics:
- **Component Preservation:** Maps ID, type, label, trust zone, configuration properties, and telemetry flags.
- **Connection Preservation:** Maps from/to endpoints, connection kind (`sync`, `async`, `event`), criticality rating ($1 \dots 5$), failure mode, and assigned operation IDs.
- **Zone Boundaries:** Preserves trust zones and external perimeter declarations.
- **Topological Integrity:** Computes in-degree, out-degree, flow depths (acyclic DAG or cycle-breaking fallback), and identifies unzoned or disconnected components without dropping them.

---

## 2. The 8 Synchronized Map Layers (`layers.ts`)

Every analytical mode is a pure mathematical projection $f(\text{VisGraph}, \text{Model}, \text{Mode}, \text{Context}) \to \text{LayerResult}$:

| Mode | Input Engine | Visual Representation | Legend & Badges |
|---|---|---|---|
| **Topology** | Canonical IR | Baseline geometric structure, component roles, trust zone hulls | Normal emphasis, type shapes |
| **Dependency** | Directed Graph Traversal | Upstream sources & downstream consumers of selection; critical paths ($\ge 4$) | `highlighted` paths, `critical` thick edges, `dimmed` unrelated |
| **Traffic** | Scenario Simulation | Request throughput, animated edge flow particles, queue saturation | `SATURATED` queue badges, `DOWN` markers, animated particle speeds |
| **Trust** | Trust Zones & Boundaries | Perimeter crossings, ingress gateways, unauthenticated internal links | `CROSS-ZONE` edge alerts, `UNPROTECTED` badges |
| **Data Lineage** | Data Entities & CRUD | Storage origins, consumer subscriptions, ETL pipelines | `STORAGE`, `PIPELINE` badges, data flow paths |
| **Failure** | Blast Radius Engine | Causal cascade propagation from injected faults | `DOWN` origin/cascades (red), `DEGRADED` dependents (amber) |
| **Recovery** | Recovery Timeline | Multistage phases (detect $\to$ restart $\to$ warmup $\to$ healthy) | Stage badges (`RESTART`, `WARMUP`, `HEALTHY`), `BOTTLENECK` |
| **Evidence** | Critic & Grounding Engine | Architecture claims, rule findings, human reviews | Finding count badges (`N findings`), severity alerts |

---

## 3. Guarantees & Non-Leakage

1. **Deterministic Execution:** The engine relies on deterministic algorithms; identical inputs always produce identical node/edge styles and summaries.
2. **State Isolation:** Modifying visual layouts (moving nodes in 3D) never alters graph topology or engine inputs. Switching projects clears selected nodes, active scenarios, and simulation contexts.
3. **No Synthetic Hallucinations:** Telemetry notes, RPS values, and failure cascades originate strictly from actual scenario runs. When unmodeled, the layer honestly returns `dimmed` with explanatory notes.

