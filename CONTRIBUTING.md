# Contributing to AEGIS-Fraud X

Thank you for contributing to AEGIS-Fraud X for DataNova 2026.

## Non-Negotiable Contribution Rules
1. **Evidence First:** Any pull request modifying model architectures, feature extractors, or policy optimizers must include corresponding evaluation benchmarks and tests.
2. **Strict Chronological Ordering:** Never introduce random cross-validation splits. Always enforce forward-chaining chronological partitions.
3. **No Fabricated Benchmarks:** Every cited metric must map to an artifact in `benchmarks/runs/`.
4. **Offline Capability:** Core unit tests and baselines must execute locally without requiring paid third-party APIs or cloud infrastructure.

## Testing Guidelines
Run the high-assurance test suite before submitting:
```bash
pytest tests/ -v
```

All 24 unit, property, and integration tests must pass.
