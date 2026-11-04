/**
 * Campaign 07 — DataNova Reality Engine Capstone E2E Test Suite
 *
 * Comprehensive end-to-end verification covering:
 *  - 4 Sovereign Reality Views (Intended, Configured, Observed, Derived)
 *  - Section 8 Mandatory Reconciliation Case (Undocumented Pricing Service call)
 *  - Interactive Drift Triage & Model Adoption Lifecycle
 *  - Ingestion Center & Cryptographic Evidence Envelopes
 *  - Runtime Intelligence & Distributed Trace Waterfall
 *  - Reliability Engineering, SLOs & Critical Path Analysis
 *  - Causal Incident Investigation & Verifiable Postmortems
 *  - Change Impact Review & Human Sign-off Gates
 *  - 3D Operational Reality Map Layers
 */

import { test, expect } from "@playwright/test";

const openReality = async (page: import("@playwright/test").Page): Promise<void> => {
  await page.goto("/#/atlas/reality");
  await expect(page.getByText("DATANOVA REALITY ENGINE", { exact: true })).toBeVisible();
};

test.describe("Campaign 07: DataNova Reality Engine Capstone", () => {
  test.beforeEach(async ({ page }) => {
    await openReality(page);
    const demoBtn = page.getByRole("button", { name: "Load Section 8 Demo" });
    if (await demoBtn.isVisible()) {
      await demoBtn.click();
      await page.waitForTimeout(150);
    }
  });

  test("1. Reality Shell & 4 Sovereign World Views", async ({ page }) => {
    // Verify header and engine title
    await expect(page.getByText("DATANOVA REALITY ENGINE", { exact: true })).toBeVisible();
    await expect(page.getByText("Architecture-to-Runtime Reconciliation")).toBeVisible();

    // Verify the 4 Sovereign Views KPI cards
    await expect(page.getByText("1. Intended")).toBeVisible();
    await expect(page.getByText("2. Configured")).toBeVisible();
    await expect(page.getByText("3. Observed")).toBeVisible();
    await expect(page.getByText("4. Derived")).toBeVisible();

    // Verify sub-navigation rail exists
    await expect(page.getByRole("button", { name: "Overview" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ingestion Center" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Runtime Intelligence" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Reconciliation/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reliability & SLOs" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Incident Intelligence" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Change Impact/ })).toBeVisible();
  });

  test("2. Section 8 Mandatory Reconciliation Fixture & Undocumented Pricing Service", async ({ page }) => {
    // Navigate to Reconciliation tab
    await page.getByRole("button", { name: /Reconciliation/ }).click();

    // Verify Section 8 Showcase Banner is prominent
    await expect(page.getByText("SECTION 8 MANDATORY RECONCILIATION DEMO")).toBeVisible();
    await expect(page.getByText("Undocumented Dependency Detection")).toBeVisible();
    await expect(page.getByText(/Target Service: Pricing Service/)).toBeVisible();
    await expect(page.getByText(/Direct synchronous pricing calls bypass the declared message queue/)).toBeVisible();

    // Verify drift record in the list
    await expect(page.getByText("Order Service → Pricing Service").first()).toBeVisible();
    await expect(page.getByText("critical").first()).toBeVisible();
  });

  test("3. Drift Triage Lifecycle & Architectural Model Adoption", async ({ page }) => {
    // Open Reconciliation tab
    await page.getByRole("button", { name: /Reconciliation/ }).click();

    // Check triage actions panel
    await expect(page.getByText("Remediation Triage:")).toBeVisible();
    const acceptBtn = page.getByRole("button", { name: /Accept as Intended/ });
    await expect(acceptBtn).toBeVisible();

    // Fill rationale and accept drift
    const rationaleInput = page.getByPlaceholder("Rationale or notes for triage decision...");
    await rationaleInput.fill("Approved synchronous pricing query per Architecture RFC-2026-44");
    await acceptBtn.click();

    // Verify action feedback
    await expect(page.getByText(/Applied action "ACCEPT_AS_INTENDED"/)).toBeVisible();
  });

  test("4. Ingestion Center & Connector Registry", async ({ page }) => {
    // Switch to Ingestion Center tab
    await page.getByRole("button", { name: "Ingestion Center" }).click();

    // Verify header and connector catalog
    await expect(page.getByRole("heading", { name: "Ingestion Center" })).toBeVisible();

    // Verify connector items
    await expect(page.getByText("OpenTelemetry Distributed Traces")).toBeVisible();
    await expect(page.getByText("Prometheus / OpenMetrics Ingestion")).toBeVisible();
    await expect(page.getByText("Structured JSON Logs & Events")).toBeVisible();
    await expect(page.getByText(/Infrastructure Manifests/)).toBeVisible();

    // Verify Read-Only boundary badge
    await expect(page.getByText("Read-Only Boundary").first()).toBeVisible();

    // Test loading sample payload
    await page.getByRole("button", { name: "Load Sample Payload" }).click();

    // Ingest & normalize
    const ingestBtn = page.getByRole("button", { name: /Ingest & Normalize/ });
    await expect(ingestBtn).toBeEnabled();
    await ingestBtn.click();

    // Verify status output
    await expect(page.getByText(/Ingested.*items successfully/)).toBeVisible();
  });

  test("5. Runtime Intelligence & Distributed Trace Waterfall", async ({ page }) => {
    // Switch to Runtime Intelligence
    await page.getByRole("button", { name: "Runtime Intelligence" }).click();

    // Verify active services table
    await expect(page.getByText("Active Runtime Services")).toBeVisible();
    await expect(page.getByText("Order Service").first()).toBeVisible();
    await expect(page.getByText("Pricing Service").first()).toBeVisible();

    // Verify Trace Explorer waterfall
    await expect(page.getByText(/Trace Waterfall/)).toBeVisible();
    await expect(page.getByText("POST /order").first()).toBeVisible();
    await expect(page.getByText("calculateDiscount").first()).toBeVisible();
    await expect(page.getByText("SELECT pricing_rules").first()).toBeVisible();
  });

  test("6. Reliability Engineering, SLOs & Critical Path Latency", async ({ page }) => {
    // Switch to Reliability tab
    await page.getByRole("button", { name: "Reliability & SLOs" }).click();

    // Verify Scorecard metrics
    await expect(page.getByText("Operational Reliability Scorecard")).toBeVisible();
    await expect(page.getByText("Composite Score:")).toBeVisible();

    // Verify SLO table
    await expect(page.getByText("Service SLO Compliance")).toBeVisible();
    await expect(page.getByText("Availability SLI").first()).toBeVisible();

    // Verify Critical Path Latency Breakdown
    await expect(page.getByText("Critical-Path Latency Analysis")).toBeVisible();
    await expect(page.getByText("Primary Bottleneck:")).toBeVisible();

    // Verify Statistical Anomaly alerts
    await expect(page.getByText("Statistical Anomaly Alerts")).toBeVisible();
  });

  test("7. Incident Intelligence, Dual Blast Radius & Attested Postmortems", async ({ page }) => {
    // Switch to Incident Intelligence tab
    await page.getByRole("button", { name: "Incident Intelligence" }).click();

    // Verify active incident banner
    await expect(page.getByText("INC-2026-089")).toBeVisible();
    await expect(page.getByText("Checkout Latency Spike & Undocumented Pricing Service Cascade")).toBeVisible();
    await expect(page.getByText("SEV-1")).toBeVisible();

    // Verify Dual Blast Radius Projection
    await expect(page.getByText("Blast Radius Discrepancy")).toBeVisible();
    await expect(page.getByText("Intended Impact Path:")).toBeVisible();
    await expect(page.getByText("Observed Impact Path:")).toBeVisible();

    // Verify Causal Hypotheses
    await expect(page.getByText("Causal Hypotheses (AI-Assisted, Zero False Certainty)")).toBeVisible();
    await expect(page.getByText(/Pricing Service v1.4.0 bypassed queue/)).toBeVisible();
    await expect(page.getByText("SUPPORTED (88%)")).toBeVisible();

    // Generate cryptographic postmortem
    const postmortemBtn = page.getByRole("button", { name: "Generate Postmortem" });
    await expect(postmortemBtn).toBeVisible();
    await postmortemBtn.click();

    // Verify postmortem package output
    await expect(page.getByText("SHA-256 Verified")).toBeVisible();
    await expect(page.getByText("Confirmed Findings:")).toBeVisible();
  });

  test("8. Change Impact Review & Human Release Gate", async ({ page }) => {
    // Switch to Change Intelligence tab
    await page.getByRole("button", { name: /Change Impact/ }).click();

    // Verify Git commit analysis
    await expect(page.getByText("Change Impact & Release Intelligence")).toBeVisible();
    await expect(page.getByText("feat(order): add direct pricing lookup to order service")).toBeVisible();

    // Verify OpenAPI Breaking Change
    await expect(page.getByText("OpenAPI Contract Diff", { exact: true })).toBeVisible();
    await expect(page.getByText("Breaking Changes Detected")).toBeVisible();

    // Verify Release Readiness Gate is BLOCKED
    await expect(page.getByText("RELEASE GATE: BLOCKED")).toBeVisible();

    // Sign off on the release
    const signoffInput = page.getByPlaceholder("Sign-off notes or waiver rationale...");
    await signoffInput.fill("Waiver granted by Principal Architect for migration window.");
    await page.getByRole("button", { name: "Record Human Sign-off" }).click();

    // Verify sign-off confirmation
    await expect(page.getByText(/Human Authorization Recorded: Approved by Lead Architect/)).toBeVisible();
  });

  test("9. Seamless Transition to 3D Spatial Studio with Operational Layers", async ({ page }) => {
    // Click "Open in 3D Studio"
    await page.getByRole("button", { name: "Open in 3D Studio" }).click();

    // Verify Studio is mounted
    await expect(page.locator("nav[aria-label='Atlas sections']")).toBeVisible();
    await expect(page.locator("#mode-select")).toBeVisible();

    // Verify that the select contains Operational Reality modes
    const modeSelect = page.locator("#mode-select");
    await modeSelect.selectOption("divergence");
    await page.waitForTimeout(200);

    // Switch to Latency layer
    await modeSelect.selectOption("latency");
    await page.waitForTimeout(200);

    // Switch to Volume layer
    await modeSelect.selectOption("volume");
    await page.waitForTimeout(200);

    // Return to reality section via navigation rail
    await page.getByRole("button", { name: "Reality Engine" }).click();
    await expect(page.getByText("DATANOVA REALITY ENGINE", { exact: true })).toBeVisible();
  });
});
