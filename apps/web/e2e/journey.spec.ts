import { test, expect } from "@playwright/test";

/**
 * End-to-end journey: transaction -> score -> decision -> receipt -> verification.
 * Runs against the REAL backend (started externally) and the production build.
 * A second spec block covers the backend-offline degraded state (API stopped).
 */

test("score -> receipt -> verify journey with live backend", async ({ page }) => {
  await page.goto("/");

  // The global degraded banner must NOT be visible when the backend is live
  // (exact: the mission-control panel also renders a lowercase
  // "backend offline" status, which must not match here)
  await expect(page.getByText("Backend offline", { exact: true })).toHaveCount(0);

  // Navigate to the Explainability Explorer
  await page.getByText("Explainability Explorer").first().click();

  // Run real model scoring on the prefilled high-risk transaction
  await page.getByRole("button", { name: "Run TreeSHAP" }).click();

  // A decision is rendered (ALLOW / CHALLENGE / REVIEW / BLOCK)
  await expect(
    page.getByText(/ALLOW|CHALLENGE|REVIEW|BLOCK/).first()
  ).toBeVisible({ timeout: 30_000 });

  // Verify the authentic receipt: server-side HMAC must match
  await page.getByRole("button", { name: "Verify Authentic" }).click();
  await expect(page.getByText("VERIFICATION RESULT: SIGNATURE_VERIFIED")).toBeVisible({
    timeout: 20_000,
  });

  // Tamper simulation: the edited receipt must fail signature verification
  await page.getByRole("button", { name: "Simulate Tamper Edit" }).click();
  await expect(page.getByText("VERIFICATION RESULT: SIGNATURE_INVALID")).toBeVisible({
    timeout: 20_000,
  });
});

test("backend offline shows the degraded banner and never claims authenticity", async ({ page }) => {
  // This test assumes the API is NOT running (see run script: e2e:offline).
  await page.goto("/");

  // exact match: only the global banner span (the mission-control status
  // chip renders lowercase "backend offline" and must not be ambiguous here)
  await expect(page.getByText("Backend offline", { exact: true })).toBeVisible({ timeout: 30_000 });

  await page.getByText("Explainability Explorer").first().click();
  await page.getByRole("button", { name: "Run TreeSHAP" }).click();

  // Offline scoring falls back (marked degraded) and verification must report
  // unavailability — it must never claim authenticity.
  await page.getByRole("button", { name: "Verify Authentic" }).click();
  await expect(
    page.getByText("VERIFICATION RESULT: VERIFICATION_UNAVAILABLE_OFFLINE")
  ).toBeVisible({ timeout: 20_000 });
});
