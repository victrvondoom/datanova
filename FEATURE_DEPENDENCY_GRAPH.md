# AEGIS-Fraud X — Feature Dependency Graph

Edges: feature -> prerequisite feature (by key). Cycles would be a validation error.

- Root features (no prerequisites): 820
- Features with prerequisites: 81
- Total dependency edges: 81

## Most-depended-on features (unlock the most work)

- `Idempotent Transaction Ingestion` (D01): unblocks 8 features
- `PII Inventory` (D23): unblocks 4 features
- `PSI Monitoring` (D26): unblocks 4 features
- `Dead-Letter Queue for Invalid Events` (D01): unblocks 3 features
- `Ingestion Schema Registry` (D01): unblocks 3 features
- `Currency Normalization` (D01): unblocks 3 features
- `Promotion Gate` (D25): unblocks 3 features
- `API Key Authentication` (D22): unblocks 2 features
- `Dataset Manifests` (D02): unblocks 2 features
- `Retention Enforcement` (D23): unblocks 2 features
- `Dataset Lineage Graph` (D02): unblocks 2 features
- `Data Freshness Markers` (D02): unblocks 2 features

## Prerequisite chains for key gaps

- **Case Intake** requires: nothing (root)
- **Override Workflow** requires: nothing (root)
- **Drift Alert Levels** requires: nothing (root)
- **Immutable Decision Log** requires: nothing (root)
