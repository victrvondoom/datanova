# AEGIS-Fraud X — Feature Gap Analysis

Highest-impact missing capabilities, evidence-driven.

## P0 integrity/safety gaps: 0


## P1 core-intelligence/ops gaps: 52

- **AFX-F0020 Exactly-Once Effect Semantics** (D01): Ensure side effects occur once despite retries
- **AFX-F0027 Ingress Authentication** (D01): Authenticate ingest callers
- **AFX-F0029 Ingest-Time PII Redaction** (D01): Drop or tokenize unnecessary PII at the boundary
- **AFX-F0057 Checksum Verification Gate** (D02): Refuse to run on hash-mismatched datasets
- **AFX-F0072 Split Overlap Detection** (D03): Detect entity overlap across splits
- **AFX-F0081 Label-Derived Feature Scan** (D03): Detect features derived from labels
- **AFX-F0082 Time-Leakage Scan** (D03): Detect future information in features
- **AFX-F0118 Train/Serve Feature Parity** (D04): Guarantee identical features both paths
- **AFX-F0122 Train/Serve Parity Tests** (D05): Assert same features for same input
- **AFX-F0140 Training Window Alignment** (D05): Align feature windows with label timing
- **AFX-F0169 Replay Idempotency** (D06): Replays must not duplicate effects
- **AFX-F0177 Decision Audit Emission** (D06): Emit decision events for downstream audit
- **AFX-F0201 Model Failure Fallback** (D07): Defined behavior when inference fails
- **AFX-F0232 Experiment Early Warnings** (D08): Flag suspicious metric jumps
- **AFX-F0351 Graph State Recovery** (D12): Rebuild graph from events after restart
- **AFX-F0379 Window Boundary Tests** (D13): Exact window membership tests
- **AFX-F0432 Explanation Fidelity Tests** (D15): Attributions match model behavior
- **AFX-F0463 Rule-Policy Interaction Contract** (D16): How rules and model combine
- **AFX-F0464 Manual Override Audit** (D16): Human overrides with reasons
- **AFX-F0482 Case Intake** (D17): Create cases from decisions/anomalies
- **AFX-F0483 Case Queue Management** (D17): Prioritized investigation queue
- **AFX-F0484 Case Lifecycle States** (D17): Open/in-progress/closed states
- **AFX-F0487 Evidence Linking** (D17): Attach receipts/features to cases
- **AFX-F0489 Case Outcome Recording** (D17): Record confirmed outcomes
- **AFX-F0507 Case Data Model** (D17): Canonical case schema
- **AFX-F0512 Evidence Collection Tools** (D18): Gather transaction/entity evidence
- **AFX-F0513 Entity Risk Profile** (D18): Full entity history view
- **AFX-F0522 Outcome Code System** (D18): Standardized outcome vocabulary
- **AFX-F0542 Review Queue UI** (D19): Analyst worklist
- **AFX-F0549 Override Workflow** (D19): Controlled decision overrides
- **AFX-F0627 Webhook Signature Verification** (D21): Authenticate partner calls
- **AFX-F0632 API Key Authentication** (D22): Authenticate API callers
- **AFX-F0636 Admin Action Authorization** (D22): Guard dangerous operations
- **AFX-F0643 Policy Edit Permissions** (D22): Control who changes policy
- **AFX-F0650 Deny-by-Default Alignment** (D22): Safe defaults for new endpoints
- **AFX-F0651 Credential Storage Hygiene** (D22): Never store plaintext secrets
- **AFX-F0659 Registry Promotion Permissions** (D22): Control artifact promotion
- **AFX-F0660 Secret Scanning** (D22): Detect committed secrets
- **AFX-F0662 PII Inventory** (D23): Know where personal data lives
- **AFX-F0663 Log Redaction** (D23): No sensitive data in logs
- **AFX-F0675 Dependency Vulnerability Auditing** (D23): Scan dependencies for CVEs
- **AFX-F0681 API Abuse Prevention** (D23): Throttle abuse
- **AFX-F0698 Change Management for Policies** (D24): Controlled policy change process
- **AFX-F0703 Override Governance** (D24): Overrides are tracked and reviewed
- **AFX-F0730 Dependency Capture in Artifacts** (D25): Record training environment
- **AFX-F0735 Registry Access Control** (D25): Restrict artifact mutation
- **AFX-F0744 No-Secrets-in-Artifacts Rule** (D25): Artifacts exclude secrets
- **AFX-F0763 Model Health Checks** (D26): Model liveness signals
- **AFX-F0847 Log Redaction Policy** (D29): No sensitive data in logs
- **AFX-F0849 Degraded-State Metrics** (D29): Count degraded responses
- **AFX-F0864 Runtime Data Sanity Checks** (D29): Validate live inputs continuously
- **AFX-F0899 Override UI** (D30): Human decision entry

## Structural bottlenecks

- No decision archive / case management: blocks D17-D19 capabilities (investigation, queues, overrides).
- No outcome feedback: blocks outcome-based evaluation, recalibration, and monitoring loops.
- No authentication/authorization: blocks most external integration and multi-user features.
- Single-process serving: blocks throughput/SLO claims; documented honestly.

## Should-NOT-Build list (rejected with rationale)

- Microservices split: single-process scale does not justify it (DEPLOYMENT_READINESS.md).
- Kubernetes: explicitly not justified at current scale.
- GraphQL gateway, autoencoder scoring, sequence models, differential privacy: P4 research until they beat baselines under the release-gated protocol.
- Cross-dataset pooled claims: prohibited by methodology.
