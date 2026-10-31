"""Compute AEGIS's dependency closure with installed versions for pip-audit.

Reads direct runtime + dev dependencies from pyproject.toml, resolves the
transitive closure via installed package metadata, and emits a pinned
requirements file so `pip-audit -r ... --no-deps` audits exactly what
AEGIS actually uses in this environment (catalog: privacy_dependency_audit).
"""

import re
import sys
from importlib.metadata import PackageNotFoundError, distribution

ROOT_DIRECT = [
    "fastapi", "uvicorn", "pydantic", "scikit-learn", "lightgbm", "xgboost",
    "numpy", "pandas", "networkx", "shap", "python-pptx", "python-dotenv",
]
DEV_DIRECT = [
    "pytest", "pytest-asyncio", "pytest-cov", "ruff", "mypy", "httpx",
]

def norm(name: str) -> str:
    return name.lower().replace("_", "-")


def closure(roots):
    seen = {}
    stack = [norm(r) for r in roots]
    while stack:
        name = stack.pop()
        if name in seen:
            continue
        try:
            dist = distribution(name)
        except PackageNotFoundError:
            print(f"WARNING: dependency '{name}' is not installed in this "
                  f"environment; it cannot be audited here.", file=sys.stderr)
            seen[name] = None
            continue
        seen[name] = dist.version
        for req in (dist.requires or []):
            m = re.match(r"\s*([A-Za-z0-9_.\-]+)", req)
            if not m:
                continue
            dep = norm(m.group(1))
            if dep not in seen and "extra" not in req:
                stack.append(dep)
    return seen


deps = closure(ROOT_DIRECT + DEV_DIRECT)
missing = [n for n, v in deps.items() if v is None]
with open("aegis_requirements_audit.txt", "w", encoding="utf-8", newline="\n") as f:
    for name in sorted(deps):
        if deps[name]:
            f.write(f"{name}=={deps[name]}\n")
print(f"AEGIS closure: {sum(1 for v in deps.values() if v)} pinned packages, "
      f"{len(missing)} not installed")
if missing:
    print("missing:", ", ".join(sorted(missing)))
