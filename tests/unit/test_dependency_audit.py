"""Tests for the dependency-audit scope (catalog: privacy_dependency_audit).

Pins the checked-in closure file to the current pyproject dependencies so
the audit scope cannot silently drift.
"""

import os
import re
import sys
from importlib.metadata import version

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from scripts.generate_dependency_audit_scope import DEV_DIRECT, ROOT_DIRECT, closure, norm

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
CLOSURE_FILE = os.path.join(ROOT, "aegis_requirements_audit.txt")


def _checked_in_closure():
    entries = {}
    with open(CLOSURE_FILE, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                name, _, ver = line.partition("==")
                entries[name] = ver
    return entries


def test_closure_covers_direct_dependencies_with_installed_versions():
    """Every pyproject direct dep resolves to an installed, pinned package."""
    deps = closure(ROOT_DIRECT + DEV_DIRECT)
    for direct in ROOT_DIRECT + DEV_DIRECT:
        assert norm(direct) in deps, f"direct dep {direct} missing from closure"
    for name in ("fastapi", "starlette", "pydantic", "xgboost", "lightgbm"):
        assert deps.get(norm(name)), f"{name} not pinned"
        assert deps[norm(name)] == version(name)


def test_closure_includes_key_transitive_dependencies():
    """The audit scope reaches the packages that actually serve HTTP."""
    deps = _checked_in_closure()
    for transitive in ("anyio", "certifi", "uvicorn", "starlette", "h11"):
        assert norm(transitive) in deps, (
            f"transitive dep {transitive} missing from audit scope; the "
            "closure generator has drifted"
        )


def test_checked_in_closure_matches_current_environment():
    """The pinned closure file reflects the environment that will be audited."""
    checked_in = _checked_in_closure()
    live = closure(ROOT_DIRECT + DEV_DIRECT)
    live_pinned = {k: v for k, v in live.items() if v}
    assert set(checked_in) == set(live_pinned), "audit scope drifted: regenerate aegis_requirements_audit.txt"
    for name, ver in checked_in.items():
        assert live_pinned.get(name) == ver, (
            f"{name}: checked-in {ver} != installed {live_pinned.get(name)}; "
            "regenerate aegis_requirements_audit.txt"
        )


def test_closure_reports_uninstalled_dependencies():
    """Uninstalled closure members are surfaced, never silently dropped."""
    deps = closure(["definitely-not-a-real-package-afx"])
    assert deps.get("definitely-not-a-real-package-afx") is None


def test_audit_artifact_exists_and_covers_current_findings():
    """The recorded audit run is present and parseable (evidence pinning)."""
    path = os.path.join(ROOT, "benchmarks/runs/dependency_audit.txt")
    assert os.path.exists(path), "dependency audit artifact missing"
    content = open(path, encoding="utf-8", errors="replace").read()
    assert re.search(r"(Found \d+ known vulnerabilities|No known vulnerabilities)", content)
    # every vulnerable package named in the artifact is part of the closure
    checked_in = _checked_in_closure()
    for m in re.finditer(r"^([A-Za-z0-9_.\-]+)\s+\d[\d.]*\s+PYSEC|^([A-Za-z0-9_.\-]+)\s+\d[\d.]*\s+CVE", content, re.M):
        pkg = norm(m.group(1) or m.group(2))
        assert pkg in checked_in, f"audit reports {pkg} outside the AEGIS closure"
