# Campaign 07 — Architecture-to-Reality Reconciliation Specification

## 1. Three-Way Reconciliation Architecture

The reconciliation engine evaluates three input topologies:
1. **Intended Graph ($G_I$):** Canonical `ArchitectureModel` nodes and directed edges.
2. **Configured Graph ($G_C$):** Resources and bindings parsed from K8s, Docker Compose, and Terraform.
3. **Observed Graph ($G_O$):** Runtime services and communicating edges synthesized from distributed traces and logs.

### Reconciliation Outcomes Matrix

| $G_I$ (Intended) | $G_C$ (Configured) | $G_O$ (Observed) | Classification | Drift Type | Severity |
|---|---|---|---|---|---|
| Present | Present | Present | **RECONCILED** | None | Info |
| Present | Present | Absent | **UNOBSERVED_RELATIONSHIP** | Topology / Stale | Medium |
| Present | Absent | Absent | **UNDEPLOYED_INTENT** | Resource Config | High |
| Present | Absent | Present | **SHADOW_DEPLOYMENT** | Resource Config | High |
| Absent | Present | Present | **UNARCHITECTED_SERVICE** | Topology | High |
| Absent | Present | Absent | **ORPHANED_CONFIGURATION** | Resource Config | Low |
| Absent | Absent | Present | **UNDOCUMENTED_DEPENDENCY** | Network Dependency | Critical |

---

## 2. Drift Classification Taxonomy

1. **Topology Drift:** Undocumented services or missing expected nodes.
2. **Resource Configuration Drift:** Differences in replica count, container images, or missing config mounts.
3. **Network Dependency Drift:** Services communicating without an architectural connection.
4. **API Contract Drift:** Incompatible schema variations or deprecated field usages.
5. **Security Boundary Drift:** Unencrypted or unauthenticated cross-zone traffic crossing DMZ/Trusted boundaries.
6. **Workload Drift:** Traffic exceeding designed capacity or unexpected queue build-up.
7. **Data Flow Drift:** Unintended read or write paths to database or storage stores.
8. **Stale Documentation:** Declared architecture edges with zero observable traffic over prolonged windows.

---

## 3. Mandatory Section 8 Demonstration Scenario

### Architecture Intent:
```
Client -> API Gateway -> Order Service -> Message Queue -> Order Worker -> Order Database
```

### Configured Infrastructure:
Kubernetes manifests declaring:
- `api-gateway` (Deployment & Service)
- `order-service` (Deployment & Service)
- `message-queue` (RabbitMQ StatefulSet)
- `order-worker` (Deployment)
- `order-database` (PostgreSQL StatefulSet)

### Observed Telemetry:
OpenTelemetry trace spans demonstrating:
- Trace `tr-001`: Client calls API Gateway
- Span `sp-002`: API Gateway calls Order Service
- Span `sp-003`: Order Service directly calls **Pricing Service** (Port 8085)
- Span `sp-004`: Pricing Service queries Order Database

### Engine Output:
1. Reconciles known nodes (`api-gateway`, `order-service`, `order-database`).
2. Detects `Pricing Service` as an **UNDOCUMENTED_DEPENDENCY** with `CONFIRMED` status.
3. Tags severity as **CRITICAL** (crosses undocumented service boundary, bypassing message queue).
4. Highlights the path in the Atlas 3D Studio and flags it in the Drift Inbox.
5. Engineer investigates, acknowledges, and records remediation: "Accept as intended and update Architecture Model" or "Deprecate direct pricing call".
