# Campaign 07 — Known Limitations & System Boundaries (Honest)

## 1. Environment & Simulation Boundaries

1. **Synthetic Telemetry Labeling:** In demonstration environments where live production telemetry feeds (e.g. AWS CloudWatch, Datadog, Prometheus cluster) are not configured, test fixtures are explicitly tagged with `SYNTHETIC_ONLY` and `sourceVersion: "fixture-v1"`. The system never fabricates live telemetry or presents synthetic benchmarks as real production data.
2. **Read-Only Scope:** The Reality Engine does not execute automatic remediations or trigger cloud deployments. All remediation actions ("Accept as intended", "Acknowledge drift") update the local architecture model and generate recommendations for human engineering review.
3. **Local Cryptographic Identity:** Digital signatures in DEP packages and postmortems utilize browser-local cryptographic keys (Ed25519 / SHA-256). Enterprise PKI or LDAP certificate authority chains require enterprise server integration.
4. **Statistical Anomaly Baseline:** Anomaly detection relies on transparent statistical distributions (IQR / Z-score) rather than black-box machine learning models, ensuring every flagged anomaly has an explainable mathematical rationale.
