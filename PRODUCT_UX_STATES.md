# AEGIS-Fraud X — Product UX State Contract

One consistent meaning for every data state, enforced across the app.

## States

| State | Meaning | Visual treatment | User action |
|:---|:---|:---|:---|
| LIVE | Fresh data from the real backend | normal (emerald accents) | none |
| DEGRADED (offline fallback) | Backend unreachable; view shows a clearly-marked snapshot or simulation | amber global banner + `degraded: true` payloads | Retry connection; treat numbers as illustrative |
| MODEL UNAVAILABLE | No valid model artifact at startup | health exposes `artifact_status` | Operator must provide a valid bundle |
| CALIBRATOR FALLBACK | Serving without the validation artifact | health exposes `calibration_source` (`reference-data` / `base-rate-prior`) | Deploy the bundle before trusting probabilities |
| VERIFICATION UNAVAILABLE | Receipt verification cannot run (offline) | amber result card: `VERIFICATION_UNAVAILABLE_OFFLINE` — never green, never a validity claim | Start the backend to verify |

## Implementation

- API layer (`apps/web/src/api.ts`): every offline fallback returns
  `degraded: true, source: "offline-fallback"`.
- Global banner (`App.tsx`): visible whenever the backend health check fails;
  states explicitly that offline numbers are simulations and that receipt
  verification will not claim authenticity.
- Verification semantics (`ExplainabilityView`): the server-signed receipt is
  verified verbatim (`audit_receipt` from `/api/score`); result states are
  `SIGNATURE_VERIFIED` (green), `SIGNATURE_INVALID` (red),
  `VERIFICATION_UNAVAILABLE_OFFLINE` (amber).

## Hard rules (verified by Playwright E2E)

1. No fabricated success: a green state never appears for degraded or
   unverified results.
2. Offline verification NEVER claims authenticity.
3. The client never reconstructs a receipt payload for verification
   (client-side reconstruction produces a different payload than the one
   signed and always fails HMAC — a real defect found and fixed by the E2E).

## Verification evidence

`apps/web/e2e/journey.spec.ts` (run via the procedure in
`scripts/run_e2e.md`): online journey (score → decision → receipt →
SIGNATURE_VERIFIED → tamper → SIGNATURE_INVALID) and offline journey
(banner visible; verification reports unavailability). Both passed
2026-10-31 against the production build and the real backend.
