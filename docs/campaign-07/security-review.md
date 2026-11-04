# Campaign 07 — Security Review & Safe Ingestion Boundaries

## 1. Threat Model & Ingestion Boundaries

DataNova Reality Engine handles sensitive infrastructure configurations and runtime telemetry. The system enforces strict read-only and isolation safeguards:

1. **Strict Read-Only Operations:**
   - No automatic cloud deployments or Terraform apply executions.
   - No Kubernetes cluster mutations or remote API write actions.
   - No production command execution or remote shell spawning.
2. **Untrusted Input Sanitation & Quarantine:**
   - All external files (Kubernetes YAML, Terraform JSON, trace exports, log files) are treated as untrusted user inputs.
   - Parsers execute in a safe JS memory sandbox without `eval()`, `Function()`, or shell child process spawns.
   - Resource limits enforced: maximum payload size (15 MB), maximum records per import (100,000), parsing timeout (5,000 ms).
   - Malformed, oversized, or unparseable payloads are routed to Evidence Quarantine without halting system operations.
3. **Sensitive Data Protection & Automated Redaction:**
   - Automated regex and key-matching filters mask sensitive fields in traces, metrics, and logs:
     - Authorization headers (`Bearer ***`, `Basic ***`)
     - API keys, secrets, private keys (`BEGIN PRIVATE KEY`)
     - Passwords and connection strings with embedded credentials (`postgres://user:pass@host`)
     - Personally Identifiable Information (email patterns, credit card patterns)
4. **Workspace Isolation:**
   - Ingested evidence, reconciliation records, and incident histories are strictly partitioned by `workspaceId`.
   - Cross-workspace queries are prohibited at the storage interface layer.
5. **Privacy Defaults:**
   - Zero transmission of ingested operational data to external AI cloud services by default.
