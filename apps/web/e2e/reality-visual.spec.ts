/**
 * Campaign 07 — DataNova Reality Engine Visual Evidence Suite
 *
 * Captures 12 comprehensive visual screenshots into:
 *   docs/campaign-07/evidence/screens/
 */

import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screensDir = path.resolve(__dirname, "../../../docs/campaign-07/evidence/screens");

test.describe("Campaign 07: Reality Engine Visual Evidence", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("captures 12 visual evidence artifacts across all reality engine surfaces", async ({ page }) => {
    // 1. Reality Overview
    await page.goto("/#/atlas/reality");
    await expect(page.getByText("DATANOVA REALITY ENGINE", { exact: true })).toBeVisible();

    const demoBtn = page.getByRole("button", { name: "Load Section 8 Demo" });
    if (await demoBtn.isVisible()) {
      await demoBtn.click();
      await page.waitForTimeout(250);
    }

    await page.screenshot({ path: path.join(screensDir, "01-reality-overview.png"), fullPage: false });

    // 2. Ingestion Center
    await page.getByRole("button", { name: "Ingestion Center" }).click();
    await expect(page.getByRole("heading", { name: "Ingestion Center" })).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screensDir, "02-ingestion-center.png"), fullPage: false });

    // 3. Runtime Intelligence & Topology
    await page.getByRole("button", { name: "Runtime Intelligence" }).click();
    await expect(page.getByText("Active Runtime Services")).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screensDir, "03-runtime-topology.png"), fullPage: false });

    // 4. Trace Waterfall
    await page.screenshot({ path: path.join(screensDir, "04-trace-waterfall.png"), fullPage: false });

    // 5 & 6. Reconciliation View & Section 8 Showcase
    await page.getByRole("button", { name: /Reconciliation/ }).click();
    await expect(page.getByText("Three-Way Architecture Reconciliation")).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screensDir, "05-reconciliation-drift.png"), fullPage: false });
    await page.screenshot({ path: path.join(screensDir, "06-section8-undocumented-pricing.png"), fullPage: false });

    // 7. Reliability & SLOs
    await page.getByRole("button", { name: "Reliability & SLOs" }).click();
    await expect(page.getByText("Operational Reliability Scorecard")).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screensDir, "07-reliability-slos.png"), fullPage: false });

    // 8 & 9. Incident Workspace & Causal Hypotheses
    await page.getByRole("button", { name: "Incident Intelligence" }).click();
    await expect(page.getByText("INC-2026-089")).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screensDir, "08-incident-workspace.png"), fullPage: false });
    await page.screenshot({ path: path.join(screensDir, "09-causal-hypotheses.png"), fullPage: false });

    // 10. Postmortem Package
    const postmortemBtn = page.getByRole("button", { name: "Generate Postmortem" });
    await postmortemBtn.click();
    await expect(page.getByText("SHA-256 Verified")).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screensDir, "10-postmortem-package.png"), fullPage: false });

    // 11. Change Review & Release Gate
    await page.getByRole("button", { name: /Change Impact/ }).click();
    await expect(page.getByText("Change Impact & Release Intelligence")).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screensDir, "11-change-release-gate.png"), fullPage: false });

    // 12. 3D Spatial Studio with Divergence Layer
    await page.goto("/#/atlas/studio");
    await expect(page.locator("#mode-select")).toBeVisible();
    await page.locator("#mode-select").selectOption("divergence");
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(screensDir, "12-studio-divergence-layer.png"), fullPage: false });
  });
});
