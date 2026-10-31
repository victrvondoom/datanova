# AEGIS-Fraud X — Engineering Decisions

Significant decisions and rejected alternatives (Milestones 1–2).

## D-1: Champion selection and policy fitting on VALIDATION only
- **Decision:** test partition never influences selection, tuning, or fitting.
- **Why:** the original protocol selected the champion and tuned policy
  thresholds on test (AFX-01) — every headline number was optimistically
  biased (92.1% → 86.1% honest).
- **Rejected:** "test-based selection with a note" (unfixable bias); nested CV
  on the synthetic set (adds complexity without changing the leakage
  conclusion).
- **Enforcement:** release gate 1 runs the real pipeline with adversarially
  mutated test labels.

## D-2: Exact policy optimizer instead of a finer grid
- **Decision:** enumerate all realizable distinct-value cut policies
  (O(m log m)); legacy percentile grid kept only as a regret diagnostic.
- **Why:** "more grid points" cannot prove optimality; the zero-inflated
  failure (AFX-06) showed the grid could silently collapse. Exactness also
  gives a defensible feasibility guarantee.
- **Rejected:** integer programming (unnecessary — the structured sweep is
  exact and fast); simply widening percentiles (no guarantee, same trap).
- **Honest result:** optimization gap is $0.00 on current data — the coarse
  grid was lucky; the win is the guarantee, and the brute-force fixtures
  proved it (and caught a real sliding-window bug during development).

## D-3: Artifact bundle with sidecar manifest hash
- **Decision:** payload file + JSON manifest carrying the payload's SHA-256.
- **Why:** IsotonicRegression is NOT pickle-byte-stable across a roundtrip;
  any checksum computed from re-pickled objects is unverifiable. File-byte
  hashing is exact.
- **Rejected:** self-checksummed single pickle (unverifiable, proven by test);
  re-fitting the calibrator on load (silently different model).

## D-4: `/api/score` returns the full server-signed receipt
- **Decision:** clients verify the returned `audit_receipt` verbatim.
- **Why:** the E2E journey proved the old client-side receipt reconstruction
  NEVER matches the signed payload (different receipt_id/cost fields/rounding)
  — "Verify Authentic" always failed against a live backend, previously
  masked by the fabricated offline verification (AFX-05).

## D-5: Receipt verification semantics stated truthfully
- **Decision:** `SIGNATURE_VERIFIED` / `SIGNATURE_INVALID` (HMAC under a
  server-held secret) instead of `VALID_AUTHENTIC`; key configurable via
  `AEGIS_RECEIPT_SECRET`; docs state the development default key is public
  and receipts are forgeable with it.
- **Rejected:** "authenticity" wording (overclaims; HMAC is not a public-key
  signature and has no revocation).

## D-6: ULB handling — no fabricated entities; duplicates dropped
- **Decision:** unique pseudo-IDs (no recurring fake accounts); `Time` excluded
  as a feature; exact duplicates dropped pre-split; no graph features.
- **Why:** the adapter originally fabricated recurring sender IDs
  (`i % 5000`), and my first ULB run misaligned features from labels via an
  unstable sort (caught because PR-AUC came out BELOW prevalence — a
  magnitude-sanity check caught what unit tests alone would not).
- **Rejected:** inventing account relationships to "enable the graph model".

## D-7: Docker Compose, not Kubernetes
- **Why:** single service, no demonstrated scaling requirement. The image is
  minimal (python:3.12-slim + libgomp1); artifacts mount at runtime.

## D-8: Frontend offline fallbacks kept but made honest
- **Decision:** keep the offline demo capability, mark every payload
  `degraded: true`, add a global banner, and make offline verification
  refuse validity claims.
- **Rejected:** removing fallbacks entirely (kills the offline demo use
  case); silent fallback (the original defect).
