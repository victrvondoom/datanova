"""AEGIS-Fraud X — 900+ Feature Catalog: curated data and generator.

The catalog is GENERATED (not hand-edited) so it is reproducible and
validated: uniqueness, domain counts, ID continuity, and evidence mapping are
checked on every run. Entries were curated from four evidence sources:
repository inspection, fraud-domain practice, user-workflow failure analysis,
and risk analysis (see FEATURE_CATALOG_900.md).

Field policy (documented, not fabricated):
- risk/effort are derived from priority tier with domain overrides allowed.
- acceptance_criteria[0] is the entry's expected outcome; the full list adds
  the generic demonstrability contract (observable behavior + regression
  test). No invented numeric targets.
- implementation_status is one of: verified | implemented_unverified |
  partial | missing | blocked | unsafe | deprecated | not_applicable, each
  with a recorded reason (status_reason).
"""

DOMAINS = {
    "D01": ("Data Ingestion and Connectors", "Import transaction and risk data"),
    "D02": ("Dataset Governance and Provenance", "Track source, rights, versions, and transformations"),
    "D03": ("Data Quality and Validation", "Detect invalid, missing, duplicate, or corrupted data"),
    "D04": ("Feature Engineering", "Derive defensible predictive signals"),
    "D05": ("Feature Store and Feature Contracts", "Reuse consistent training and serving features"),
    "D06": ("Real-Time Event and Stream Processing", "Process transaction events reliably"),
    "D07": ("Fraud Model Architecture", "Improve predictive modeling"),
    "D08": ("Training and Experiment Management", "Reproducible training and comparison"),
    "D09": ("Calibration and Probability Integrity", "Ensure probability semantics are valid"),
    "D10": ("Decision Policy and Optimization", "Select feasible actions under documented costs"),
    "D11": ("Cost Engine and Digital Twin", "Reconcile decisions and economic outcomes"),
    "D12": ("Graph Fraud Intelligence", "Identify relationships and coordinated activity"),
    "D13": ("Behavioral and Temporal Intelligence", "Analyze patterns across time"),
    "D14": ("Anomaly and Novel Fraud Detection", "Detect unfamiliar or emerging patterns"),
    "D15": ("Explainability and Evidence", "Explain model and policy behavior honestly"),
    "D16": ("Risk Segmentation and Rules", "Apply documented risk-specific logic"),
    "D17": ("Case Management", "Manage fraud cases and their lifecycle"),
    "D18": ("Investigation and Evidence Collection", "Support traceable investigations"),
    "D19": ("Analyst Operations", "Support review queues and human decisions"),
    "D20": ("API, SDK, and Developer Interfaces", "Provide reliable integration surfaces"),
    "D21": ("External Integrations", "Connect authorized data and operational systems"),
    "D22": ("Identity and Access Control", "Restrict access appropriately"),
    "D23": ("Privacy and Security", "Protect sensitive data and system integrity"),
    "D24": ("Governance and Audit", "Maintain decision and model accountability"),
    "D25": ("Model Registry and Deployment", "Version, validate, and promote models"),
    "D26": ("Monitoring and Drift Detection", "Detect operational and statistical changes"),
    "D27": ("Evaluation and Benchmark Infrastructure", "Measure actual performance and failure modes"),
    "D28": ("Cloud Infrastructure and Deployment", "Support reproducible deployment"),
    "D29": ("Reliability and Observability", "Detect, diagnose, and recover from failures"),
    "D30": ("Product UX, Accessibility, and Developer Experience", "Make the system usable and understandable"),
}

# Entry: (domain, key, name, description, problem, outcome, status, priority,
#         evidence_files, dependency_keys, status_reason)
F: list[tuple[str, str, str, str, str, str, str, str, list[str], list[str], str]] = []

def d(domain, key, name, desc, problem, outcome, status, pri, ev, deps, reason=""):
    F.append((domain, key, name, desc, problem, outcome, status, pri, ev, deps, reason))

# ---------------------------------------------------------------- D01
for e in [
("ingest_idem", "Idempotent Transaction Ingestion", "Deduplicate repeated event delivery by transaction_id", "Repeated delivery distorts counts and decisions", "Re-delivery is detected and reported without duplicate effects", "verified", "P1", ["apps/api/integrity.py", "apps/api/main.py", "tests/integration/test_serving_integrity.py"], [], "IdempotencyCache: replay returns the original decision without re-applying graph/ledger effects (regression-tested)"),
 ("ingest_batch_api", "Batch Ingestion API", "Import transaction files in one audited call", "Bulk onboarding requires per-row calls", "Batch import returns per-row accept/reject results", "missing", "P2", [], [], "New proposal"),
 ("ingest_schema_registry", "Ingestion Schema Registry", "Versioned input schemas with compatibility checks", "Schema drift breaks consumers silently", "Incompatible payloads are rejected with explicit errors", "partial", "P2", ["packages/data/schemas.py"], [], "Pydantic contracts exist; no versioning/compatibility policy"),
 ("ingest_stream_kafka", "Kafka-Compatible Stream Ingestion", "Consume transaction topics at production scale", "HTTP-only ingestion caps throughput", "Topics consumed with at-least-once + idempotent dedup", "missing", "P3", [], ["ingest_idem"], "New proposal; no Kafka in current deployment"),
 ("ingest_backpressure", "Backpressure and Ingest Limits", "Bound queue depth and reject cleanly under load", "Overload degrades latency for all users", "Bounded queues with explicit overload responses", "missing", "P2", [], [], "New proposal"),
 ("ingest_dlq", "Dead-Letter Queue for Invalid Events", "Quarantine malformed events for inspection", "Malformed events are dropped or crash workers", "Invalid events land in a DLQ with reason metadata", "missing", "P2", [], [], "New proposal"),
 ("ingest_webhook", "Webhook Event Ingestion", "Accept signed webhook events from partners", "Partner systems need a push interface", "Signed events accepted, verified, and acknowledged", "missing", "P3", [], ["ingest_idem"], "New proposal"),
 ("ingest_paysim_adapter", "PaySim Source Adapter", "Ingest PaySim-format files", "PaySim evaluation blocked without adapter runtime use", "PaySim files load, validate, and standardize", "partial", "P1", ["packages/data/adapters/paysim.py", "tests/unit/test_dataset_adapters.py"], [], "Adapter tested with fixtures; dataset blocked on Kaggle credentials"),
 ("ingest_ulb_adapter", "ULB Source Adapter", "Ingest ULB-format files", "External evaluation needs a validated loader", "ULB files load with stable ordering and no fabricated entities", "verified", "P1", ["packages/data/adapters/ulb.py", "tests/unit/test_dataset_adapters.py", "scripts/run_ulb_evaluation.py"], [], "Contract-tested; used by external evaluation"),
 ("ingest_csv_validator", "Streaming CSV Validator", "Validate large CSVs without full in-memory load", "150MB+ files exhaust memory", "Chunked validation with row-level error reporting", "missing", "P2", [], [], "New proposal"),
 ("ingest_parquet", "Parquet Ingestion", "Read columnar datasets", "CSV-only limits formats and speed", "Parquet loads with the same contracts as CSV", "missing", "P3", [], [], "New proposal"),
 ("ingest_dedup_report", "Ingestion Deduplication Report", "Report duplicates found per import", "Duplicate prevalence is invisible", "Per-import duplicate counts and ratios reported", "missing", "P2", [], ["ingest_idem"], "New proposal"),
 ("ingest_replay_source", "Replay Source Ingestion", "Re-ingest historical streams for reprocessing", "Reprocessing requires ad-hoc scripts", "Named replay runs produce auditable artifacts", "partial", "P2", ["apps/api/main.py"], [], "Replay-batch endpoint exists; no named reprocessing runs"),
 ("ingest_rate_shape", "Token-Bucket Ingest Shaping", "Smooth bursts before processing", "Bursts distort velocity features", "Bursts are shaped with documented token policy", "missing", "P3", [], [], "New proposal"),
 ("ingest_entity_resolution", "Entity Resolution at Ingestion", "Normalize account/device identifiers", "Alias variants evade graph linking", "Aliases resolve to canonical entities with a mapping table", "missing", "P2", [], [], "New proposal"),
 ("ingest_currency_norm", "Currency Normalization", "Convert amounts to a base currency", "Mixed currencies distort amount features", "Amounts normalized with recorded FX rates and dates", "missing", "P2", [], [], "New proposal"),
 ("ingest_tz_norm", "Timezone Normalization", "Normalize timestamps to UTC", "Mixed timezones corrupt temporal features", "All timestamps stored in UTC with source offset retained", "partial", "P2", ["packages/graph/temporal_graph.py"], [], "Graph normalizes naive/aware datetimes; no source-offset retention"),
 ("ingest_envelope", "Standard Event Envelope", "Wrap events with id, source, time, and trace fields", "Consumers infer missing metadata", "Every event carries a validated envelope", "missing", "P2", [], [], "New proposal"),
 ("ingest_at_least_once", "At-Least-Once Delivery Semantics", "Guarantee no event loss with redelivery", "Lost events create silent blind spots", "Delivery retries with dedup ensuring exactly-once effects", "missing", "P2", [], ["ingest_idem"], "New proposal"),
 ("ingest_exactly_once_effects", "Exactly-Once Effect Semantics", "Ensure side effects occur once despite retries", "Retries duplicate decisions and graph edges", "All downstream effects are idempotent per event", "missing", "P1", [], ["ingest_idem"], "New proposal"),
 ("ingest_poison_resistance", "Poison-Message Resistance", "Isolate pathological payloads", "One hostile payload can stall a stream", "Poison messages quarantined with bounded resource use", "missing", "P2", [], ["ingest_dlq"], "New proposal"),
 ("ingest_source_config", "Configurable Source Connectors", "Declare sources in configuration", "Adding a source requires code changes", "Sources configured declaratively with validation", "missing", "P3", [], [], "New proposal"),
 ("ingest_ordinal_integrity", "Event Ordering Integrity", "Preserve source order where semantics require it", "Reordering breaks chronological features", "Order preserved or explicitly annotated as best-effort", "partial", "P1", ["packages/data/adapters/ulb.py"], [], "Adapters use stable sorts; no end-to-end ordering contract yet"),
 ("ingest_dedup_window", "Configurable Dedup Window", "Bound the idempotency horizon", "Unbounded dedup state grows forever", "Dedup window configured and reported", "missing", "P2", [], ["ingest_idem"], "New proposal"),
 ("ingest_schema_diff", "Schema Diff on Contract Change", "Show exactly what changed between schema versions", "Silent schema change corrupts downstream", "Diffs reported with breaking-change classification", "missing", "P2", [], ["ingest_schema_registry"], "New proposal"),
 ("ingest_historical_gapfill", "Historical Gap Detection", "Detect missing periods in ingested history", "Gaps silently bias temporal features", "Gap report with severity per entity/period", "missing", "P2", [], [], "New proposal"),
 ("ingest_ingress_auth", "Ingress Authentication", "Authenticate ingest callers", "Anonymous ingestion allows poisoning", "Only authenticated sources can ingest", "missing", "P1", [], ["authn_apikeys"], "No authentication on API today (single-user local system)"),
 ("ingest_payload_size_limit", "Payload Size Limits", "Reject oversized requests early", "Oversized payloads cause resource exhaustion", "Documented limit with 413 responses", "missing", "P2", [], [], "New proposal"),
 ("ingest_field_redaction", "Ingest-Time PII Redaction", "Drop or tokenize unnecessary PII at the boundary", "PII enters systems that do not need it", "Declared PII fields tokenized before storage", "missing", "P1", [], ["privacy_pii_inventory"], "New proposal; minimizes exposure"),
 ("ingest_reconcile_counts", "Ingestion Count Reconciliation", "Confirm accepted+rejected+dupes == submitted", "Silent drops misstate volumes", "Per-import reconciliation assertion and report", "missing", "P2", [], [], "New proposal"),
]:
    d("D01", *e)

# ---------------------------------------------------------------- D02
for e in [
 ("prov_manifests", "Dataset Manifests", "Record counts, prevalence, splits, and checksums per dataset", "Untracked datasets make results unreproducible", "Every dataset has a verifiable manifest", "verified", "P1", ["datasets/manifests/synthetic_10k_manifest.json", "packages/data/splitters.py"], [], "Manifest written by benchmark; schema in DatasetManifest"),
 ("prov_source_registry", "Source Registry", "Register every data source with license and owner", "Sources are discovered only from prose", "Registry lists source, license, version, contact", "partial", "P1", ["DATA_PROVENANCE.md"], [], "Documented for synthetic/ULB/PaySim; not a machine-readable registry"),
 ("prov_sha256", "Artifact Hashing", "Hash datasets and artifacts with SHA-256", "Silent file changes corrupt evidence", "Hashes recorded and compared on load", "verified", "P1", ["packages/artifacts/bundle.py", "DATA_PROVENANCE.md"], [], "Bundle payload hashed; ULB ARFF hash recorded"),
 ("prov_license_register", "License Compliance Register", "Track permitted usage per dataset", "Unclear rights block redistribution", "License terms recorded with review dates", "partial", "P2", ["DATA_PROVENANCE.md"], [], "License notes recorded; no review-date workflow"),
 ("prov_lineage_graph", "Dataset Lineage Graph", "Trace any artifact back to raw inputs", "Undocumented transformations block audits", "Lineage queryable from artifact to source", "missing", "P2", [], ["prov_manifests"], "New proposal"),
 ("prov_transform_log", "Transformation Log", "Record every dataset mutation", "Undocumented edits change results silently", "Append-only transform log with parameters", "missing", "P2", [], [], "New proposal"),
 ("prov_versioning", "Dataset Versioning", "Version datasets independently of code", "Reproducing old runs becomes impossible", "Semantic dataset versions referenced by runs", "missing", "P2", [], ["prov_manifests"], "New proposal"),
 ("prov_retention_policy", "Retention Policy Enforcement", "Expire data per policy", "Indefinite retention violates data minimization", "Retention rules applied with expiry evidence", "missing", "P2", [], ["privacy_retention"], "New proposal"),
 ("prov_erasure", "Right-to-Erasure Workflow", "Delete entities' data on request", "Erasure requests cannot be honored reliably", "Entity deletion with receipt and reindex", "missing", "P3", [], ["privacy_pii_inventory"], "Not applicable to fully anonymized external data; needed for any real entity data"),
 ("prov_external_blockers", "Acquisition Blocker Ledger", "Record why a dataset cannot be acquired", "Blocked datasets are rediscovered repeatedly", "Blocker documented with unblock steps", "verified", "P2", ["DATA_PROVENANCE.md", "DATASET_CARDS.md"], [], "PaySim blocker documented with exact unblocking procedure"),
 ("prov_dataset_cards", "Dataset Cards", "Standardized dataset documentation", "Dataset quirks are learned by accident", "Card per dataset with limitations", "verified", "P2", ["DATASET_CARDS.md"], [], "Cards exist for synthetic, ULB, PaySim-pending"),
 ("prov_freshness", "Data Freshness Markers", "Record observation vs ingestion times", "Stale data silently degrades features", "Freshness visible per source and feature", "missing", "P2", [], [], "New proposal"),
 ("prov_cross_dataset_rules", "Cross-Dataset Usage Rules", "Prevent pooling incompatible datasets", "Pooled results overstate generalization", "Policy blocks cross-dataset claims by default", "verified", "P1", ["BENCHMARK_METHODOLOGY.md"], [], "Cross-dataset raw PR-AUC comparison prohibited"),
 ("prov_synthetic_labeling", "Synthetic Data Labeling", "Mark synthetic evidence everywhere", "Synthetic results can masquerade as real", "SIMULATED tags on artifacts and UI", "verified", "P0", ["packages/data/schemas.py", "DATASET_CARDS.md"], [], "DatasetDesignation enum; cards and reports label data"),
 ("prov_right_to_audit", "Audit Export of Provenance", "Export provenance bundles for external review", "Auditors cannot inspect evidence easily", "Single export contains all lineage evidence", "missing", "P3", [], ["prov_lineage_graph"], "New proposal"),
 ("prov_fork_protection", "Artifact Overwrite Protection", "Prevent new runs silently replacing evidence", "Overwritten artifacts destroy history", "Runs versioned; previous artifacts retained", "partial", "P1", ["scripts/run_benchmarks.py"], [], "Run id + benchmark hash in bundle manifest; artifacts still overwrite files"),
 ("prov_env_capture", "Environment Capture in Provenance", "Record python/library versions per run", "Environment drift breaks reproduction", "Run records exact dependency versions", "missing", "P2", [], [], "README documents versions; artifacts do not capture them"),
 ("prov_data_owner_field", "Data Owner Metadata", "Identify accountable owners per source", "No one knows who to ask about a dataset", "Owner and escalation contact per source", "missing", "P3", [], ["prov_source_registry"], "New proposal"),
 ("prov_substitute_prevention", "Substitute-Dataset Prevention", "Detect synthetic data labeled as real", "Fake external results poison trust", "Integrity checks tie results to hashed real files", "partial", "P0", ["DATA_PROVENANCE.md", "AGENTS.md"], [], "Hashes recorded for ULB; automated verification not enforced"),
 ("prov_split_manifests", "Split Manifests", "Record exact split boundaries", "Split ambiguity enables leakage", "Split sizes, boundaries, and strategy recorded", "verified", "P1", ["packages/data/splitters.py", "benchmarks/runs/benchmark_summary.json"], [], "Manifest includes split strategy and counts"),
 ("prov_schema_versioning", "Schema Version History", "Version the canonical transaction schema", "Silent schema change breaks all adapters", "Schema versions with migration notes", "missing", "P2", [], ["ingest_schema_registry"], "New proposal"),
 ("prov_purpose_limitation", "Purpose Limitation Tags", "Declare permitted uses per dataset", "Research data can leak into operational paths", "Use tags enforced at load time", "missing", "P3", [], [], "New proposal"),
 ("prov_geographic_scope", "Geographic Scope Metadata", "Record coverage regions", "Regional assumptions stay hidden", "Coverage recorded and surfaced in reports", "missing", "P3", [], [], "ULB is European; not machine-readable"),
 ("prov_time_scope", "Temporal Scope Metadata", "Record covered time ranges", "48-hour datasets are mistaken for general", "Time range recorded and surfaced", "verified", "P2", ["DATASET_CARDS.md"], [], "ULB 48-hour limitation documented"),
 ("prov_acquisition_runbook", "Acquisition Runbooks", "Step-by-step dataset acquisition guides", "Reacquisition requires tribal knowledge", "Runbook per external dataset", "verified", "P2", ["DATA_PROVENANCE.md"], [], "Exact unblock steps for PaySim"),
 ("prov_external_verification", "External Dataset Verification", "Verify claimed dataset properties against source", "Mirrors can be modified or wrong", "Row/class counts cross-checked with published profile", "verified", "P1", ["DATA_PROVENANCE.md"], [], "ULB verified against published 284,807/492 profile"),
 ("prov_checksum_gate", "Checksum Verification Gate", "Refuse to run on hash-mismatched datasets", "Modified data silently changes results", "Evaluation aborts on checksum mismatch", "missing", "P1", [], ["prov_sha256"], "Hash recorded but not enforced at load"),
 ("prov_data_contract_tests", "Data Contract Tests", "Test datasets against declared contracts", "Contract drift passes unnoticed", "CI fails on contract violation", "partial", "P1", ["tests/unit/test_data_contracts.py"], [], "Contract tests exist for synthetic schema; not for external files"),
 ("prov_usage_metrics", "Dataset Usage Metrics", "Track which runs used which data", "Results cannot be tied to data", "Every artifact lists its dataset version", "verified", "P1", ["benchmarks/runs/benchmark_summary.json"], [], "dataset_manifest embedded in artifacts"),
 ("prov_minimization_review", "Data Minimization Review", "Periodically drop unneeded fields", "Collected-but-unused data expands risk", "Field-level usage review with removal evidence", "missing", "P3", [], ["privacy_pii_inventory"], "New proposal"),
]:
    d("D02", *e)

# ---------------------------------------------------------------- D03
for e in [
 ("dq_duplicate_detection", "Duplicate Row Detection", "Find exact duplicate records", "Duplicates leak train rows into test", "Duplicates reported and dropped pre-split", "verified", "P1", ["scripts/run_ulb_evaluation.py", "reports/ULB_EVALUATION.md"], [], "1,081 ULB duplicates detected and dropped"),
 ("dq_near_duplicate", "Near-Duplicate Detection", "Detect approximate duplicates", "Near-dupes still leak and distort", "Similarity-based duplicate report", "missing", "P2", [], [], "New proposal"),
 ("dq_missing_report", "Missing-Value Report", "Profile nulls per column", "Nulls distort features silently", "Null profile per dataset and split", "partial", "P1", ["scripts/run_ulb_evaluation.py"], [], "ULB audit reports 0 NaNs; no general profiler"),
 ("dq_schema_conformance", "Schema Conformance Validation", "Reject records violating the schema", "Malformed rows corrupt training", "Nonconforming rows rejected with reasons", "verified", "P1", ["packages/data/schemas.py", "packages/data/adapters/ulb.py"], [], "Pydantic validation + adapter schema checks"),
 ("dq_range_checks", "Range and Domain Checks", "Validate numeric domains and enums", "Impossible values poison features", "Out-of-range values rejected per field", "partial", "P2", ["packages/data/schemas.py"], [], "Amount>0 and label ranges enforced; velocity fields unchecked"),
 ("dq_referential_integrity", "Referential Integrity Checks", "Validate references between entities", "Dangling references break graph features", "Referential violations reported", "missing", "P2", [], [], "New proposal"),
 ("dq_temporal_consistency", "Temporal Consistency Checks", "Ensure event times are monotonic where required", "Shuffled times corrupt chronological splits", "Order violations reported per source", "partial", "P1", ["packages/data/adapters/ulb.py", "packages/data/splitters.py"], [], "Stable sorts at adapters; no explicit violation report"),
 ("dq_label_validity", "Label Validity Checks", "Validate label semantics", "Wrong labels invalidate everything", "Label distribution and invalid labels reported", "verified", "P1", ["packages/data/schemas.py"], [], "Labels constrained to 0/1 with optional presence"),
 ("dq_amount_sanity", "Amount Sanity Analysis", "Detect impossible amount patterns", "Zero/negative amounts distort cost models", "Amount profile with anomaly flags", "partial", "P2", ["packages/data/schemas.py"], [], "Strictly-positive enforced; no profile analysis"),
 ("dq_outlier_profile", "Outlier Profiling", "Characterize heavy tails per feature", "Outliers drive false feature importance", "Outlier report per numeric feature", "missing", "P2", [], [], "New proposal"),
 ("dq_class_balance", "Class Balance Report", "Report fraud prevalence per split", "Prevalence shifts invalidate calibration", "Prevalence recorded per split", "verified", "P1", ["benchmarks/runs/benchmark_summary.json"], [], "Manifests record fraud counts and prevalence"),
 ("dq_split_independence", "Split Overlap Detection", "Detect entity overlap across splits", "Entity overlap inflates metrics", "Overlap report before training", "missing", "P1", [], [], "Synthetic splits random by time; entity overlap unchecked"),
 ("dq_statistical_profile", "Statistical Data Profiler", "Standard descriptive statistics per column", "Manual inspection wastes analyst time", "One-command profile report", "missing", "P2", [], [], "New proposal"),
 ("dq_data_drift_input", "Input Drift Snapshot", "Snapshot input distributions at ingestion", "Silent input drift degrades models", "Distribution snapshot persisted per window", "missing", "P2", [], ["monitor_psi"], "New proposal"),
 ("dq_quarantine_workflow", "Quarantine Workflow", "Hold suspicious records for review", "Bad data must not be silently dropped", "Quarantined records reviewable and restorable", "missing", "P2", [], ["ingest_dlq"], "New proposal"),
 ("dq_reconciliation_totals", "Cross-Stage Count Reconciliation", "Counts must agree across pipeline stages", "Rows vanish between stages silently", "Stage-by-stage count assertions", "missing", "P2", [], [], "New proposal"),
 ("dq_encoding_integrity", "Encoding Integrity Checks", "Detect file encoding corruption", "Encoding issues corrupt identifiers", "Encoding validated on load", "missing", "P3", [], [], "New proposal"),
 ("dq_header_contracts", "Header Contracts", "Validate file headers against contracts", "Column reordering breaks parsers", "Header order and names enforced", "partial", "P2", ["packages/data/adapters/ulb.py"], [], "Required-columns check exists; order not enforced"),
 ("dq_type_coercion_report", "Type Coercion Report", "Report coerced values", "Silent coercion masks bad data", "Coercion counts per field reported", "missing", "P2", [], [], "New proposal"),
 ("dq_time_ordering_flag", "Pre-Sortedness Flag", "Annotate datasets as sorted/unsorted", "Sort assumptions differ per source", "Sortedness recorded in manifests", "missing", "P2", [], [], "New proposal"),
 ("dq_leakage_scan_labels", "Label-Derived Feature Scan", "Detect features derived from labels", "Label leakage inflates metrics", "Automated suspicious-feature report", "missing", "P1", [], [], "New proposal; complements release gates"),
 ("dq_leakage_scan_time", "Time-Leakage Scan", "Detect future information in features", "Future info inflates metrics", "Automated temporal leakage report", "missing", "P1", [], [], "Protocol is chronological; no automated scan"),
 ("dq_entropy_alerting", "Low-Entropy Alerting", "Flag features with no information", "Constant features waste capacity", "Zero/low-variance feature report", "missing", "P2", [], [], "New proposal"),
 ("dq_id_uniqueness", "Identifier Uniqueness Audit", "Verify ID uniqueness where required", "Duplicate IDs break joins and dedup", "Uniqueness audit per ID field", "partial", "P1", ["packages/data/adapters/ulb.py", "tests/unit/test_dataset_adapters.py"], [], "ULB pseudo-IDs tested unique; no general audit"),
 ("dq_currency_consistency", "Currency Consistency Checks", "Ensure amounts share a currency scope", "Mixed currencies distort amounts", "Currency field validated against declared scope", "missing", "P2", [], ["ingest_currency_norm"], "New proposal"),
 ("dq_feedback_loop_data", "Ground-Truth Feedback Ingestion", "Ingest confirmed fraud outcomes", "Models never learn from outcomes", "Label updates ingested with provenance", "missing", "P2", [], [], "New proposal"),
 ("dq_backfill_rules", "Backfill Validation Rules", "Validate historical corrections", "Backfills silently change history", "Backfill operations logged and diffed", "missing", "P3", [], [], "New proposal"),
 ("dq_test_data_hygiene", "Test-Split Hygiene Report", "Assert test data was never touched", "Test hygiene must be demonstrable", "Hygiene report generated per benchmark", "verified", "P0", ["tests/release/test_gate_benchmark_protocol.py"], [], "Adversarial label-mutation gate proves invariance"),
 ("dq_quality_score", "Composite Data Quality Score", "Summarize dataset health", "Raw profiles are hard to compare", "Documented composite score per dataset", "missing", "P3", [], [], "New proposal; scoring must not become a vanity metric"),
 ("dq_label_delay_semantics", "Label Delay Semantics", "Document and handle delayed labels", "Chargeback lag biases retrospective metrics", "Label-delay policy documented per dataset", "missing", "P2", [], [], "LIMITATIONS notes 30-90d chargeback lag; no per-dataset delay policy exists"),
]:
    d("D03", *e)

# ---------------------------------------------------------------- D04
for e in [
 ("feat_pipeline", "Tabular Feature Pipeline", "Velocity, history z-scores, and ratio features", "Raw transactions lack predictive structure", "Deterministic feature matrix with named schema", "verified", "P1", ["packages/features/pipeline.py", "tests/unit/test_features.py"], [], "33 features, train-only fitting, tested"),
 ("feat_train_only_fitting", "Train-Only Preprocessor Fitting", "Fit transforms on training data only", "Fitting on test leaks future information", "Zero-lookahead fitting enforced", "verified", "P0", ["scripts/run_benchmarks.py", "BENCHMARK_METHODOLOGY.md"], [], "Scaler/pipeline fitted on train; protocol documented"),
 ("feat_rolling_windows", "Rolling Window Aggregations", "1h/6h/24h velocity aggregations", "Point-in-time features miss bursts", "Multi-window velocity features", "verified", "P1", ["packages/features/temporal.py"], [], "Rolling windows implemented and tested"),
 ("feat_entity_velocity", "Entity Velocity Features", "Per-account transaction cadence", "Account-level bursts signal takeover", "Entity-scoped counts and rates", "verified", "P1", ["packages/features/pipeline.py"], [], "Included in pipeline"),
 ("feat_amount_ratios", "Amount Ratio Features", "Amount vs user history", "Absolute amounts ignore user baselines", "Ratio and z-score amount features", "verified", "P1", ["packages/features/pipeline.py"], [], "amount_ratio_24h implemented"),
 ("feat_graph_features", "Graph-Derived Features", "Degree, cycle, reciprocity, PageRank signals", "Coordination is invisible in tabular rows", "Graph features with temporal windows", "verified", "P1", ["packages/graph/features.py", "tests/unit/test_graph.py"], [], "6 graph features with windowed extraction"),
 ("feat_time_of_day", "Time-of-Day Features", "Cyclical hour-of-day encoding", "Fraud concentrates in off hours", "Sin/cos time encodings", "missing", "P2", [], [], "New proposal"),
 ("feat_dow_features", "Day-of-Week Features", "Weekly behavioral cycles", "Weekend patterns differ for fraud", "Day-of-week encodings", "missing", "P3", [], [], "New proposal"),
 ("feat_device_history", "Device History Features", "Device tenure and novelty", "New devices elevate risk", "Device age and change features", "missing", "P2", [], [], "Device sharing exists in graph; tenure features absent"),
 ("feat_merchant_profile", "Merchant Profile Features", "Merchant category risk profiles", "Merchant context shapes risk", "Category-level aggregates as features", "missing", "P2", [], [], "New proposal"),
 ("feat_balance_delta", "Balance Delta Features", "Pre/post balance changes", "Balance manipulation signals fraud", "Balance delta and ratio features", "missing", "P2", [], [], "PaySim has balances; features not built (blocked dataset)"),
 ("feat_peer_comparison", "Peer-Group Comparison", "Compare users to similar cohorts", "Individual baselines miss cohort drift", "Cohort-relative features", "missing", "P3", [], [], "New proposal"),
 ("feat_cross_currency_spend", "Cross-Border Spend Features", "Foreign-transaction patterns", "Cross-border flows correlate with fraud", "Cross-border flags and shares", "missing", "P2", [], [], "Location field exists; features absent"),
 ("feat_velocity_acceleration", "Velocity Acceleration", "Second derivative of activity", "Sudden acceleration beats raw counts", "Delta-of-delta features", "missing", "P2", [], [], "New proposal"),
 ("feat_recurrence_patterns", "Recurrence Regularity", "Regularity of transaction cadence", "Bots exhibit unnatural regularity", "Regularity scores per entity", "missing", "P2", [], [], "New proposal"),
 ("feat_agg_leakage_guard", "Aggregation Leakage Guard", "Ensure aggregates exclude current tx", "Including the present leaks the label", "Strictly-past windows enforced", "partial", "P0", ["packages/features/temporal.py"], [], "Windows designed as past-only; no explicit regression test of exclusion"),
 ("feat_missingness_features", "Missingness Indicators", "Model absence of data explicitly", "Missingness itself is signal", "Indicator features for key gaps", "missing", "P2", [], [], "New proposal"),
 ("feat_interaction_terms", "Curated Interaction Terms", "Domain-motivated feature crosses", "Models may miss key interactions", "Documented interaction features", "missing", "P3", [], [], "New proposal"),
 ("feat_frequency_encoding", "Frequency Encoding", "Category frequency features", "Rare categories carry risk signal", "Frequency features with train-only stats", "missing", "P2", [], [], "New proposal"),
 ("feat_target_encoding_guard", "Guarded Target Encoding", "Target encoding with leakage protection", "Naive target encoding leaks labels", "Smoothed, train-only, cross-fitted encoding", "missing", "P3", [], ["dq_leakage_scan_labels"], "New proposal; only with leakage tests"),
 ("feat_text_hash_features", "Text Field Hash Features", "Stable hashed encodings for free text", "Raw text is high-cardinality and sensitive", "Hashed, dimensionality-bounded features", "missing", "P3", [], ["privacy_pii_inventory"], "New proposal"),
 ("feat_amount_binning", "Threshold-Aware Amount Binning", "Behaviorally motivated amount bins", "Structure-preserving binning aids rules", "Documented bin edges as features", "missing", "P3", [], [], "New proposal"),
 ("feat_windowed_graph_stats", "Windowed Graph Statistics", "Graph metrics over rolling windows", "Static graph metrics miss evolution", "Windowed degree/cycle features", "verified", "P1", ["packages/graph/features.py", "packages/graph/temporal_graph.py"], [], "24h windows with retention pruning"),
 ("feat_cold_start_path", "Cold-Start Feature Path", "Defined features for new entities", "New accounts lack history", "Documented fallback features for tenure-0 entities", "partial", "P2", ["LIMITATIONS.md"], [], "Limitation documented; no explicit feature contract"),
 ("feat_feasibility_bounds", "Feature Feasibility Bounds", "Bound features to documented ranges", "Unbounded features destabilize models", "Clipping bounds recorded in contracts", "missing", "P2", [], [], "New proposal"),
 ("feat_drift_resilient_subset", "Drift-Resilient Feature Subset", "Identify stable features under drift", "Some features degrade faster than others", "Stability-ranked feature report", "missing", "P3", [], ["monitor_psi"], "New proposal"),
 ("feat_semantic_names_registry", "Feature Semantic Registry", "Meaning and units per feature", "Unnamed features invite misuse", "Registry with definition and unit per feature", "verified", "P2", ["packages/features/semantics.py", "scripts/generate_feature_semantics.py", "tests/unit/test_batch_g.py", "FEATURE_SEMANTICS.md"], [], "Registry with definition/unit/family/derivation-source per feature, read from temporal.py/pipeline.py (not invented); dynamic ch_*/cat_* one-hots covered by prefix rules; validate_coverage raises on any unexplained schema feature; 33/33 champion features documented; generation validated by 5 unit tests"),
 ("feat_train_serve_parity_check", "Train/Serve Feature Parity", "Guarantee identical features both paths", "Skew between training and serving degrades", "Parity test with fixed inputs", "missing", "P1", [], ["store_parity_tests"], "New proposal"),
 ("feat_feature_noise_tests", "Feature Noise Sensitivity Tests", "Assert features respond to real signal", "Broken features can look plausible", "Perturbation-based feature sanity tests", "missing", "P2", [], [], "New proposal"),
 ("feat_computation_perf_budget", "Feature Computation Budget", "Bound feature computation latency", "Slow features break real-time SLAs", "Per-feature latency budget with measurement", "partial", "P2", ["README.md"], [], "Latency measured end-to-end; no per-feature budget"),
]:
    d("D04", *e)

# ---------------------------------------------------------------- D05
for e in [
 ("store_feature_contracts", "Typed Feature Contracts", "Single schema for extraction, training, serving", "Divergent schemas produce silent corruption", "One contract used by all consumers", "verified", "P1", ["packages/data/schemas.py", "packages/features/pipeline.py"], [], "Pydantic contracts + pipeline feature names"),
 ("store_parity_tests", "Train/Serve Parity Tests", "Assert same features for same input", "Serving features can drift from training", "Deterministic parity fixtures pass", "missing", "P1", [], [], "New proposal"),
 ("store_online_offline_def", "Online/Offline Feature Definitions", "Same computation for batch and streaming", "Two definitions fork silently", "Single implementation both paths", "partial", "P1", ["packages/features/pipeline.py", "apps/api/main.py"], [], "API reuses pipeline; graph serving path differs from batch extraction"),
 ("store_feature_versioning", "Feature Set Versioning", "Version feature sets with artifacts", "Feature changes orphan models", "Feature-set version recorded per model", "partial", "P2", ["packages/artifacts/bundle.py"], [], "Bundle records feature_names; no independent version tag"),
 ("store_backfill_api", "Feature Backfill API", "Recompute historical features", "New features need historical values", "Backfill produces auditable outputs", "missing", "P3", [], [], "New proposal"),
 ("store_entity_registry", "Entity Type Registry", "Canonical entity types and keys", "Ad-hoc entity keys break joins", "Declared entity types with key formats", "missing", "P2", [], [], "New proposal"),
 ("store_point_in_time_correctness", "Point-in-Time Correctness", "Features computed only from past events", "Future data in features is leakage", "Point-in-time guarantees tested", "partial", "P0", ["packages/features/temporal.py", "BENCHMARK_METHODOLOGY.md"], [], "Chronological windows; explicit exclusion test absent"),
 ("store_feature_freshness", "Feature Freshness Metadata", "Record feature computation time", "Stale features mislead decisions", "Freshness exposed per feature", "missing", "P2", [], ["prov_freshness"], "New proposal"),
 ("store_materialization_cache", "Feature Materialization Cache", "Cache heavy aggregates", "Recomputation wastes latency budget", "Cache with invalidation policy", "missing", "P3", [], [], "New proposal"),
 ("store_dag_lineage", "Feature DAG Lineage", "Declared feature dependencies", "Feature order is tribal knowledge", "DAG drives computation and documentation", "missing", "P2", [], [], "New proposal"),
 ("store_schema_drift_alerts", "Feature Schema Drift Alerts", "Detect input schema changes", "Upstream changes corrupt features", "Alert on undeclared field changes", "missing", "P2", [], ["ingest_schema_diff"], "New proposal"),
 ("store_feature_metrics", "Feature Quality Metrics", "Population stability per feature", "Feature drift must be measurable", "PSI per feature in monitoring", "missing", "P2", [], ["monitor_psi"], "New proposal"),
 ("store_null_semantics", "Null Semantics Contract", "Define meaning of missing values per feature", "Nulls mean different things per source", "Declared null semantics with defaults", "missing", "P2", [], [], "New proposal"),
 ("store_deterministic_keys", "Deterministic Feature Keys", "Stable feature identifiers across runs", "Reordering breaks consumers", "Stable key ordering guaranteed", "verified", "P2", ["packages/features/pipeline.py", "tests/unit/test_features.py"], [], "feature_names deterministic; used in bundle"),
 ("store_serving_isolation", "Serving Feature Isolation", "Serving cannot trigger training paths", "Serving-time fitting is a leakage vector", "Serving uses fitted artifacts only", "verified", "P0", ["apps/api/main.py", "packages/artifacts/bundle.py"], [], "API loads fitted bundle; no fit calls in serving path"),
 ("store_feature_flags", "Feature-Set Feature Flags", "Toggle feature subsets safely", "New features ship all-or-nothing", "Flagged feature subsets per model", "missing", "P3", [], [], "New proposal"),
 ("store_cross_entity_features", "Cross-Entity Feature Sharing", "Reuse aggregates across entity types", "Duplicate computations drift apart", "Shared aggregates with single definition", "missing", "P3", [], [], "New proposal"),
 ("store_dataclass_exports", "Feature Export for Analysis", "Export feature matrices for notebooks", "Analysts recompute features ad hoc", "One-command export with provenance", "missing", "P3", [], [], "New proposal"),
 ("store_feature_documentation", "Per-Feature Documentation", "Purpose and behavior per feature", "Features are used without understanding", "Docs generated from registry", "verified", "P2", ["scripts/generate_feature_semantics.py", "FEATURE_SEMANTICS.md", "feature_semantics.json"], [], "Per-feature documentation is now generated from the semantic registry (FEATURE_SEMANTICS.md + feature_semantics.json), pinned by test_generated_semantics_files_are_current and test_semantics_generator_output_is_complete"),
 ("store_training_windows_alignment", "Training Window Alignment", "Align feature windows with label timing", "Misaligned windows are leakage", "Window/label alignment tested", "missing", "P1", [], [], "New proposal"),
 ("store_scale_reuse", "Scaler Reuse in Serving", "Serve with training-fitted scalers", "Serving-time scaling is leakage", "Scaler loaded from artifact", "verified", "P1", ["packages/artifacts/bundle.py", "scripts/run_ulb_evaluation.py"], [], "ULB run fits scaler on train; bundle carries fitted objects"),
 ("store_feature_audit_trail", "Feature Computation Audit Trail", "Record what produced each feature vector", "Feature disputes cannot be resolved", "Per-request feature trace", "missing", "P2", [], [], "New proposal"),
 ("store_multi_dataset_contracts", "Dataset-Specific Feature Contracts", "Different datasets need different features", "One-size contracts force fabrication", "Per-dataset feature contracts", "verified", "P1", ["scripts/run_ulb_evaluation.py", "packages/data/adapters/ulb.py"], [], "ULB uses V1-28+Amount only; no forced graph features"),
 ("store_feature_failure_modes", "Feature Failure Documentation", "Document how each feature fails", "Failure modes surprise operators", "Failure-mode catalog per feature", "missing", "P3", [], [], "New proposal"),
 ("store_feature_to_action_mapping", "Feature-to-Decision Influence Map", "Show which features drive actions", "Operators cannot sanity-check decisions", "Influence map from SHAP aggregates", "partial", "P2", ["packages/explainability/shap_engine.py"], [], "Per-decision SHAP exists; no aggregate map"),
 ("store_contract_tests_ci", "Feature Contract Tests in CI", "Run contract tests on every change", "Contract drift ships silently", "CI includes feature contract suite", "partial", "P1", [".github/workflows/ci.yml", "tests/unit/test_features.py"], [], "Tests run in CI; parity tests absent"),
 ("store_hot_reload_safety", "Hot Reload Safety for Features", "Change features without corrupting serving", "Mid-flight changes corrupt decisions", "Atomic feature-set swap", "missing", "P3", [], [], "New proposal"),
 ("store_feature_cardinality_limits", "Cardinality Limits", "Bound category cardinality", "Unbounded categories destabilize models", "Cardinality caps with explicit handling", "missing", "P2", [], [], "New proposal"),
 ("store_time_budget_asserts", "Feature Time Budget Assertions", "Fail if features exceed budget", "Slow features surface only in production", "Latency budget tests in CI", "missing", "P2", [], ["feat_computation_perf_budget"], "New proposal"),
 ("store_feature_deprecation_policy", "Feature Deprecation Policy", "Retire features safely", "Dead features accumulate risk", "Deprecation workflow with migration", "missing", "P3", [], [], "New proposal"),
]:
    d("D05", *e)

# ---------------------------------------------------------------- D06
for e in [
 ("stream_replay_batch", "Transaction Stream Replay", "Serve historical batches for live comparison", "Live data is needed to exercise decisions", "Deterministic replay with per-record costs", "verified", "P1", ["apps/api/main.py", "tests/integration/test_api.py"], [], "replay-batch endpoint with twin costs, tested"),
 ("stream_inject", "Live Transaction Injection", "Inject transactions into stream and graph", "Operators need controlled live testing", "Injected events scored and graphed", "verified", "P1", ["apps/api/main.py", "tests/integration/test_api.py"], [], "inject endpoint tested"),
 ("stream_offset_paging", "Stream Pagination", "Page through the replay stream", "Unbounded responses are unusable", "Bounded pages with wraparound", "verified", "P2", ["apps/api/main.py"], [], "offset/limit with modulo wraparound"),
 ("stream_graph_forward_chaining", "Forward Graph Chaining", "Scored events update graph state", "Stale graphs miss emerging rings", "Graph updates on every scored tx", "verified", "P1", ["apps/api/main.py", "packages/graph/temporal_graph.py"], [], "add_transaction after scoring"),
 ("stream_window_pruning", "Temporal Window Pruning", "Bound graph memory by retention", "Unbounded graphs slow lookups", "Retention-based pruning", "verified", "P1", ["packages/graph/temporal_graph.py"], [], "prune_older_than with 168h retention"),
("stream_exactly_once_effects", "Exactly-Once Stream Effects", "Duplicates cannot double-apply effects", "Retries corrupt graph and counts", "Idempotent stream application", "partial", "P1", ["apps/api/integrity.py", "apps/api/main.py", "tests/integration/test_serving_integrity.py"], ["ingest_idem"], "Score path is exactly-once by idempotency; replay mode intentionally re-applies (documented)"),
 ("stream_outbox_pattern", "Transactional Outbox", "Atomic state + event publication", "Dual writes diverge silently", "Outbox guarantees atomic publication", "missing", "P3", [], [], "New proposal"),
 ("stream_event_sourcing", "Event-Sourced Decision State", "Rebuild state from event log", "State corruption has no recovery path", "Replayable event log with rebuild proof", "missing", "P2", [], [], "New proposal"),
 ("stream_checkpointing", "Stream Checkpointing", "Resume processing after failure", "Crashes lose in-flight work", "Checkpoints with resume evidence", "missing", "P2", [], [], "New proposal"),
 ("stream_partitioning", "Parallel Stream Partitions", "Scale by partition key", "Single-threaded processing caps throughput", "Partitioned processing with per-key order", "missing", "P3", [], [], "New proposal"),
 ("stream_lag_metrics", "Consumer Lag Metrics", "Measure processing backlog", "Lag is invisible until too late", "Lag reported and alertable", "missing", "P2", [], [], "New proposal"),
 ("stream_poison_isolation", "Stream Poison Isolation", "Quarantine bad events mid-stream", "One bad event stalls the stream", "Poison events skipped and logged", "missing", "P2", [], ["ingest_poison_resistance"], "New proposal"),
 ("stream_ordering_guarantee", "Per-Entity Ordering Guarantee", "Preserve order per entity", "Interleaved events corrupt entity features", "Per-entity sequencing enforced", "missing", "P2", [], [], "New proposal"),
 ("stream_latency_slos", "Stream Latency SLOs", "Budget and measure end-to-end latency", "Slow decisions are worthless", "p95/p99 latency per stage", "partial", "P2", ["apps/api/main.py"], [], "Per-request inference latency recorded; no stream-wide SLO"),
 ("stream_deadline_propagation", "Deadline Propagation", "Propagate processing deadlines", "Late work wastes capacity", "Deadlines enforced per stage", "missing", "P3", [], [], "New proposal"),
 ("stream_backfill_mode", "Stream Backfill Mode", "Reprocess history without live effects", "Backfills corrupt live state", "Isolated backfill runs", "missing", "P2", [], [], "New proposal"),
 ("stream_dual_write_prevention", "Dual-Write Prevention", "Avoid divergent writes across stores", "State stores drift apart", "Single-writer or outbox discipline", "missing", "P2", [], ["stream_outbox_pattern"], "New proposal"),
 ("stream_flow_control", "Consumer Flow Control", "Pause consumers under stress", "Overwhelmed consumers compound errors", "Flow control with documented policy", "missing", "P3", [], [], "New proposal"),
 ("stream_replay_idempotency", "Replay Idempotency", "Replays must not duplicate effects", "Replay corrupts cumulative counters", "Replay-safe effect computation", "missing", "P1", [], ["ingest_idem"], "Replay currently mutates graph state (documented)"),
 ("stream_event_enrichment", "Stream Enrichment", "Join reference data at processing time", "Context-less events limit features", "Enrichment with bounded latency", "missing", "P2", [], [], "New proposal"),
 ("stream_windowed_aggregation", "Windowed Stream Aggregations", "Continuous aggregates over event time", "Batch computation is too slow", "Incremental window aggregates", "partial", "P2", ["packages/features/temporal.py"], [], "Batch windows exist; incremental streaming absent"),
 ("stream_watermarking", "Event-Time Watermarks", "Bound lateness in event time", "Late events corrupt windows", "Watermarks with documented lateness bound", "missing", "P3", [], [], "New proposal"),
 ("stream_schema_evolution", "Stream Schema Evolution", "Evolve event schemas safely", "Schema change breaks consumers", "Compatible evolution policy", "missing", "P2", [], ["ingest_schema_registry"], "New proposal"),
 ("stream_dlq_replay", "DLQ Replay Tooling", "Reprocess quarantined events", "Quarantined events are lost work", "Replay with dedup and audit", "missing", "P3", [], ["ingest_dlq"], "New proposal"),
 ("stream_shadow_traffic", "Shadow Traffic Mode", "Mirror production events for testing", "Testing on live traffic is risky", "Shadow mode with no user-visible effects", "missing", "P3", [], [], "New proposal"),
 ("stream_canary_decisions", "Canary Decision Rollout", "Limit exposure of new policies", "Policy changes affect all traffic instantly", "Canary percentage with comparison", "missing", "P2", [], ["pol_policy_versioning"], "New proposal"),
 ("stream_audit_emit", "Decision Audit Emission", "Emit decision events for downstream audit", "Decisions are not archived as events", "Per-decision audit event", "missing", "P1", [], ["govern_decision_log"], "New proposal"),
 ("stream_error_categorization", "Stream Error Categorization", "Classify stream failures", "Errors are indistinguishable", "Category counts per window", "missing", "P2", [], [], "New proposal"),
 ("stream_processing_guarantees_doc", "Processing Guarantees Documentation", "State delivery semantics explicitly", "Implicit semantics mislead integrators", "Documented at-least-once/effectively-once policy", "partial", "P1", ["DEPLOYMENT_READINESS.md"], [], "Stateful single-process limitation documented"),
 ("stream_graceful_drain", "Graceful Stream Drain", "Finish in-flight work on shutdown", "Shutdown drops live events", "Drain completes within deadline", "missing", "P2", [], ["deploy_graceful_shutdown"], "New proposal"),
]:
    d("D06", *e)
