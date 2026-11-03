# Campaign 05 — Test & Evidence Report

All results executed in this campaign's final verification run (2026-11-03),
against the working tree that is committed for Campaign 05.

## 1. Frontend unit tests (vitest)

```bash
cd apps/web && npm test
```

**Result: 17 test files, 371/371 passed.**

New Campaign-05 suites (85 cases):
- `c05-grounding.test.ts` (22) — source/claim/case registry integrity,
  grounded explanations, counterexample corpus, nonvisual engine.
- `c05-benchvalid.test.ts` (21) — benchmark provenance classification,
  grounded-corpus evaluation, scoring traces + reconstruction, review
  protocol/disagreement/quality, validity dashboard, external validation
  report.
- `c05-exchange.test.ts` (42) — DEP format/export/serialization, integrity
  (tamper, truncation), safe import (oversize, malformed, prototype
  pollution, strict schema, unknown sources, future versions, broken
  models, staged non-mutation), redaction, inbox/outbox lifecycle + legal
  transitions, annotations, responses (digest-binding), semantic diff,
  reconciliation, provenance chain, migration, replay.

Plus all C04/C03 suites re-run green in the same run.

## 2. Lint + types + build

```bash
npx oxlint src   # Found 0 warnings and 0 errors (123 files)
npx tsc -b --force  # 0 errors
npm run build    # ✓ built
```

## 3. Playwright — two-phase procedure

### Phase A — API stopped (offline/degraded state)

```bash
npx playwright test e2e/lab.spec.ts e2e/lab-a11y.spec.ts e2e/lab-c05.spec.ts \
                     e2e/trail.spec.ts e2e/trail-a11y.spec.ts
# => 26 passed
npx playwright test e2e/journey.spec.ts --grep "backend offline"
# => 1 passed
```

**27/27 passed**, including the new `e2e/lab-c05.spec.ts` (4 tests):
1. **Two-user capstone** (Task 41): Architect A exports a package (two
   browser contexts) → Reviewer B validates/receives/inspects/accepts
   staged adoption → annotates → resolves → downloads the review response →
   A imports the response → provenance visible on both sides.
2. Tampered/future-version package rejected in isolation; receive stays
   disabled.
3. A11y: zero unlabeled controls across `#root`; ARIA tablist roving focus
   (Arrow keys, `aria-selected`, focus assertions); intent-compile
   announcement via `role="status"`.
4. Nonvisual summary, grounded explanations (source names + conditions),
   validity dashboard (`[not-yet-validated]`, "PROTOCOL READY — NOT
   EXECUTED") render as text.

A C04 test was updated **for semantics, not to pass**: tab buttons now
expose `role="tab"` (ARIA tablist) — the keyboard journey is unchanged and
still asserted; the locator follows the improved role.

**Defect found and fixed:** the new unlabeled-control scan found the
dashboard theme toggle had no accessible name → `aria-label` added and
verified at UIA level.

### Phase B — API running (online journey)

```bash
AEGIS_CORS_ORIGINS="http://localhost:4173,http://127.0.0.1:4173" \
  python -m uvicorn apps.api.main:app --port 8002 &
# wait for /api/health (per scripts/run_e2e.md)
npx playwright test e2e/journey.spec.ts --grep "live backend"
# => 1 passed
```

**Honest note:** the first phase-B attempt failed because the run started
before the API finished loading the model (~8s wait instead of a health
check — a procedure violation by the operator, not a product defect).
After waiting for `/api/health` as documented, the journey passed 3×
consecutively. Recorded here rather than hidden.

## 4. Platform-level accessibility evidence (see human-verification-report.md)

UI Automation tree captured from headed, accessibility-forced Chromium via
.NET `System.Windows.Automation`: 89 named controls; the ARIA tablist is
exposed as UIA `Tab`/`TabItem`; all controls named; theme-toggle fix
visible. Evidence: `docs/campaign-05/evidence/uia-intent-tab.txt`.
Classification: AUTOMATED (platform tree) — NOT manual AT verification.
NVDA: BLOCKED (not installed). Narrator: present, protocol ready, not executed.

## 5. Python suite (fraud engine — unaffected by the lab, verified to protect the repo contract)

```bash
python -m pytest tests/ -W ignore        # 141 passed
python -m pytest tests/release/         # 12 passed (mandatory release gates)
python -m mypy packages apps scripts --ignore-missing-imports   # Success: no issues in 59 source files
python -m ruff check .                    # All checks passed!
```

## 6. Checks NOT run (and why)

- **Real screen-reader testing (NVDA/JAWS/VoiceOver)** — NVDA/JAWS not
  installed (installation requires user authorization); VoiceOver needs an
  Apple environment; Narrator is installed but validating announcements
  requires a human listener. Protocols ready; see the honest run log.
- **Real human benchmark review** — the review protocol + rubric +
  assessment engine exist and are tested, but zero assessments are recorded;
  the validity dashboard reports `not-yet-validated` accordingly.
- **Cryptography-based package signing** — no signing library or key
  management exists in the project; explicitly unsupported and documented
  (checksums detect corruption only).

## 7. Evidence index

| Evidence | Location |
|---|---|
| Grounding engine tests | `apps/web/src/lab/__tests__/c05-grounding.test.ts` (22) |
| Benchmark-validity tests | `apps/web/src/lab/__tests__/c05-benchvalid.test.ts` (21) |
| Exchange/DEP tests | `apps/web/src/lab/__tests__/c05-exchange.test.ts` (42) |
| New engines | `apps/web/src/lab/engines/{sources,claims,cases,grounding,counterexamples,benchvalid,review,nonvisual,dep,exchange,known-engines}.ts` |
| Exchange UI | `apps/web/src/lab/panels/Exchange.tsx` + `#/lab/exchange` route |
| Two-user e2e capstone | `apps/web/e2e/lab-c05.spec.ts` (4 tests, incl. download round trip) |
| UIA accessibility capture | `docs/campaign-05/evidence/uia-intent-tab.txt` |
| Registry mirror (human) | `docs/campaign-05/external-grounding-registry.md` |
| DEP specification | `docs/campaign-05/evidence-exchange-spec.md` |
| Security report + threat model | `docs/campaign-05/security-review.md` |
| Human verification ledger | `docs/campaign-05/human-verification-report.md` |
| Benchmark validation report | `docs/campaign-05/benchmark-validation-report.md` |
