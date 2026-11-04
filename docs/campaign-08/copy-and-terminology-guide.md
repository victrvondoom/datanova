# DataNova Campaign 08 — Copy & Terminology Guide
**Task 13 & 14 Deliverables** · *Plain-Language Product Communication*

---

## 1. Product Communication Philosophy

1. **Clarity First:** Speak to intelligent engineers and technical leaders in direct, human terms before revealing deep architectural jargon.
2. **Intent Over Mechanism:** Describe what an action achieves for the user, not the internal engine that executes it.
3. **No Decorative Jargon:** Avoid acronyms and opaque abstractions unless accompanied by plain-language context.
4. **Progressive Disclosure:** Provide immediate clarity on the surface, with full technical depth accessible on-demand via inspectors and technical details drawers.

---

## 2. Terminology Translation Dictionary

| Confusing / Internal Technical Term | Preferred Plain-Language User Term | Secondary / In-Depth Technical Label | Explanation |
|---|---|---|---|
| Architecture IR / Canonical Graph | **System Map / Architecture Model** | Canonical Graph Model | The declared components and connections representing how the system is designed. |
| Three-Way Architecture Reconciliation | **Comparing Design vs Reality** | Three-Way State Reconciliation | Finding differences between what was planned, what was deployed, and what actually ran. |
| Undocumented Dependency Ingress | **Unexpected / Undocumented Connection** | Undocumented Ingress Edge | When a service calls another service in production without being documented in the architecture. |
| Counterfactual Blast-Radius Analysis | **Checking What Could Be Affected** | Causal Blast-Radius Simulation | Simulating how a failure or change would ripple through connected components. |
| Evidence Envelope | **Verified Evidence Record** | Cryptographic Evidence Envelope | An immutable, tamper-evident record of an observation, test, or simulation signed with SHA-256. |
| Runtime Topology | **Live Service Network** | Observed Runtime Topology | The actual network of communicating services reconstructed from live distributed traces. |
| SLO Burn-Rate Multiplier | **Error Budget Consumption Rate** | SLO Error Budget Burn Rate | How rapidly unexpected latency or errors are consuming the service's allowable downtime budget. |
| Multi-Agent DAG Orchestration | **DataNova Orchestrator** | Multi-Agent Coordination Engine | Specialist AI agents collaborating under a unified coordinator to investigate your question. |
| Trust Boundary Traversal | **Security Boundary Crossing** | Trust Boundary Transition | When data or requests pass from a public or less-trusted network zone into a protected internal zone. |
| Data Lineage Chain | **Data Movement & Storage Path** | End-to-End Data Lineage | Tracking where data originates, which services process it, and where it is persisted. |
| Isotonic Probability Calibration | **Calibrated Confidence Score** | Isotonic Calibration | Converting raw statistical model outputs into realistic probabilities grounded in actual historical data. |

---

## 3. The Five Core Questions for Every Section

Every major view or workflow in DataNova must answer:

1. **What is this?** Concise explanation of the view.
2. **Why should I care?** The engineering or operational consequence.
3. **What does DataNova use to do this?** The underlying data or engine inputs.
4. **What can I do here?** Concrete actions available right now.
5. **What happens next?** Where the workflow leads.

---

## 4. Architectural Glossary (User-Facing)

- **Architecture:** The plan and blueprint of your software components, services, and connections.
- **Service:** An independent software program that performs a specific set of jobs (e.g., Order Service, Pricing Service).
- **Connection / Dependency:** When one service requires or calls another service to do its job.
- **Runtime:** What happens when your software is actually operating and serving user traffic in production.
- **Trace:** A record of a single user request as it travels through multiple services from start to finish.
- **Metric:** Quantitative measurements of system health over time, such as requests per second or latency.
- **SLO (Service Level Objective):** The agreed reliability target (e.g. 99.9% uptime or p95 latency < 150ms).
- **Drift:** An unexpected difference between what your architecture diagram says and what is actually running in production.
- **Simulation:** A modeled experiment that predicts how the system would behave under different conditions without affecting production.
- **Evidence:** Tangible proof—such as traces, configuration manifests, or test outputs—that supports a technical conclusion.
- **Provenance:** The verifiable chain of custody showing where an insight came from and who produced it.
- **Independent Review:** An objective inspection of findings and evidence by an independent technical reviewer.
