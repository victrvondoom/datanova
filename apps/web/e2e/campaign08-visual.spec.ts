/**
 * Campaign 08 — DataNova Visual Evidence Capture Suite
 *
 * Captures 12 high-resolution screenshots documenting the unified product:
 * Home, Workspace (all 5 subviews), Evidence & Review (all 6 subviews),
 * and the Central Multi-Agent Orchestrator.
 */

import { test } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREEN_DIR = path.resolve(__dirname, "../../../docs/campaign-08/evidence/screens");

test("captures 12 visual evidence screenshots across the unified product experience", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  // 1. Home Starting Experience
  await page.goto("/#/home");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SCREEN_DIR, "01-c08-home-landing.png"), fullPage: false });

  // 2. Workspace: Overview
  await page.goto("/#/workspace/overview");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SCREEN_DIR, "02-c08-workspace-overview.png"), fullPage: false });

  // 3. Workspace: System Map (3D Studio)
  await page.goto("/#/workspace/map");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SCREEN_DIR, "03-c08-workspace-system-map.png"), fullPage: false });

  // 4. Workspace: Analyze (Scenarios)
  await page.goto("/#/workspace/analyze");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SCREEN_DIR, "04-c08-workspace-analyze-scenarios.png"), fullPage: false });

  // 5. Workspace: Analyze (SLOs & Reliability)
  await page.getByRole("button", { name: "Reliability & SLOs" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SCREEN_DIR, "05-c08-workspace-analyze-slos.png"), fullPage: false });

  // 6. Workspace: Investigate (Reality Engine)
  await page.goto("/#/workspace/investigate");
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SCREEN_DIR, "06-c08-workspace-investigate-reality.png"), fullPage: false });

  // 7. Workspace: Improve & Compare (Decisions)
  await page.goto("/#/workspace/improve");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SCREEN_DIR, "07-c08-workspace-improve-decisions.png"), fullPage: false });

  // 8. Workspace: Improve & Compare (Release Impact Gate)
  await page.getByRole("button", { name: "Release Impact & Gate" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SCREEN_DIR, "08-c08-workspace-improve-release.png"), fullPage: false });

  // 9. Evidence & Review: Findings
  await page.goto("/#/evidence/findings");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SCREEN_DIR, "09-c08-evidence-findings.png"), fullPage: false });

  // 10. Evidence & Review: Sources
  await page.goto("/#/evidence/sources");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SCREEN_DIR, "10-c08-evidence-sources.png"), fullPage: false });

  // 11. Evidence & Review: Reviews (Validation Room)
  await page.goto("/#/evidence/reviews");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SCREEN_DIR, "11-c08-evidence-reviews.png"), fullPage: false });

  // 12. Central Multi-Agent Orchestrator Execution Report
  await page.goto("/#/home");
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /Ask Orchestrator/ }).click();
  await page.getByRole("button", { name: "Investigate why checkout requests are slow" }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREEN_DIR, "12-c08-orchestrator-execution-report.png"), fullPage: false });
});
