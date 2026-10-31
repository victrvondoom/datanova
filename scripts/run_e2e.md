# AEGIS-Fraud X — E2E Reproduction Procedure

Playwright suite: `apps/web/e2e/journey.spec.ts`
Verified 2026-10-31: online journey PASSED (1.8s), offline journey PASSED (0.7s).

## One-time setup

```bash
cd apps/web
npm ci
npm i -D @playwright/test
npx playwright install chromium
```

## Run (online journey — real backend)

```bash
# 1. Build the frontend
cd apps/web && npm run build && cd ..

# 2. Start the API (CORS must include the preview origin) and wait for health
AEGIS_CORS_ORIGINS="http://localhost:4173,http://127.0.0.1:4173" \
  python -m uvicorn apps.api.main:app --port 8002 &

# 3. Serve the production build
cd apps/web && npx vite preview --port 4173 --strictPort &

# 4. Run the online journey
cd apps/web && npx playwright test e2e/journey.spec.ts --grep "live backend"
```

## Run (offline degraded journey)

Stop the API, keep the preview server, then:

```bash
cd apps/web && npx playwright test e2e/journey.spec.ts --grep "backend offline"
```

## What the journeys assert

- **Online:** no degraded banner; navigation to Explainability Explorer; real
  model scoring; a decision renders; "Verify Authentic" →
  `VERIFICATION RESULT: SIGNATURE_VERIFIED`; "Simulate Tamper Edit" →
  `SIGNATURE_INVALID`.
- **Offline:** the global "Backend offline" banner is visible; scoring falls
  back (degraded); verification reports `VERIFICATION_UNAVAILABLE_OFFLINE` —
  it never claims authenticity.
