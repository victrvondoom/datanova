# Dependency Vulnerability Audit

**Feature:** `privacy_dependency_audit` · **Tool:** `pip-audit 2.10.1` (PyPI advisory service)
**Scope:** the transitive dependency closure of AEGIS-Fraud X's runtime + dev
dependencies — computed from `pyproject.toml` via
`scripts/generate_dependency_audit_scope.py`, pinned to installed versions
in `aegis_requirements_audit.txt` (52 packages).

## Procedure (reproducible)

```bash
python scripts/generate_dependency_audit_scope.py
pip-audit -r aegis_requirements_audit.txt --no-deps --desc off \
  > benchmarks/runs/dependency_audit.txt
```

The scoped audit is deliberate: this host Python environment is shared with
other projects; auditing the whole environment reports advisories for
packages AEGIS never imports.

## Findings — 2026-10-31 run

- **Initial audit:** 91 known advisories across 6 packages of the closure.
- **Remediated in this environment** (patch/minor upgrades, full test suite
  re-run green, 124/124):
  | Package | From | To | Advisories closed |
  |---|---|---|---|
  | anyio | 4.13.0 | 4.15.1 | 2 |
  | certifi | 2026.2.25 | 2026.10.23 | 1 |
  | python-dotenv (direct dep) | 1.0.1 | 1.2.4 | 1 |
- **After remediation:** 85 advisories across 3 packages.
- Full raw output preserved in `benchmarks/runs/dependency_audit.txt`.

## Open advisories and why they are NOT yet remediated here

| Package | Installed | Fix version | Blocker |
|---|---|---|---|
| starlette | 0.41.3 | 0.47.2+ / 1.x | `fastapi 0.115.6` pins `starlette<0.42`; fixing requires a coordinated fastapi upgrade — not performed in the shared host environment to avoid breaking other projects on this machine. Blocked on an isolated venv/container (NEXT-02/NEXT-04) or dedicated upgrade task. |
| pillow | 11.1.0 | 12.x / 13.0.0 | Transitive via `python-pptx 1.0.2`; major-version upgrade must be validated against pptx image handling. Not upgraded in the shared environment for the same reason. |
| pytest | 8.3.4 | 9.0.3 | Major version bump; affects every test run on this shared environment. Dev-only exposure (not shipped). |

**Operational note:** the HTTP-serving exposure of the open items
(starlette) matters only in deployments exposing the API beyond localhost —
the declared deployment context of this repository. The remediation path is
an environment-isolated upgrade (`pip install -U fastapi` inside the
container/venv) followed by the full quality gates.

## Cadence and gates

- Re-run the procedure before every release candidate and after any
  dependency change; store outputs under `benchmarks/runs/`.
- The closure file `aegis_requirements_audit.txt` is checked in and pinned by
  `tests/unit/test_dependency_audit.py`, which fails if the checked-in
  closure no longer matches the current `pyproject.toml` + environment —
  the audit scope cannot silently drift.

## Limitations

- `pip-audit` reports *known* advisories only; absence of findings is not a
  safety guarantee.
- One closure dependency (`nvidia-nccl-cu13`, optional xgboost GPU extra) is
  not installed in this environment and therefore not audited.
- The shared host environment means remediation here is conservative;
  the container image (NEXT-02) is the right place for aggressive upgrades.
