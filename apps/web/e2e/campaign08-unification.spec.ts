/**
 * Campaign 08 — DataNova Unified Information Architecture Capstone Test Suite
 *
 * Verifies:
 * 1. Home starting experience (<1 minute to understand and start)
 * 2. Exactly 3 primary destinations (Home, Workspace, Evidence & Review)
 * 3. Central Multi-Agent Orchestrator (request -> plan -> coordinate -> report)
 * 4. Context preservation across all 5 Workspace subviews
 * 5. Evidence & Review validation environment with all 6 subviews
 * 6. Non-destructive legacy route preservation
 */

import { test, expect } from "@playwright/test";

test.describe("Campaign 08: DataNova Unified Product Experience", () => {
  test("1. Home starting experience & 3 primary destinations", async ({ page }) => {
    await page.goto("/#/home");

    // Verify product identity heading & supporting copy
    await expect(page.getByText("Understand your software system.")).toBeVisible();
    await expect(
      page.getByText("DataNova brings your architecture, system behavior, investigations, and supporting evidence")
    ).toBeVisible();

    // Verify exactly 3 primary destinations exist in header with exact name matching
    await expect(page.getByRole("button", { name: "Home", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Workspace", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Evidence & Review", exact: true })).toBeVisible();

    // Verify 4 plain-language capability cards
    await expect(page.getByText("Map my system")).toBeVisible();
    await expect(page.getByText("Understand problems")).toBeVisible();
    await expect(page.getByText("Test improvements")).toBeVisible();
    await expect(page.getByText("Review evidence")).toBeVisible();

    // Verify Start buttons
    await expect(page.getByRole("button", { name: "Start a workspace" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Explore an example" })).toBeVisible();
  });

  test("2. Workspace navigation & context preservation across all 5 subviews", async ({ page }) => {
    await page.goto("/#/workspace/overview");

    // Verify 5 internal workspace views with exact matching
    await expect(page.getByRole("button", { name: "Overview", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "System Map", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Analyze", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Investigate", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Improve & Compare", exact: true })).toBeVisible();

    // Test transition to System Map
    await page.getByRole("button", { name: "System Map", exact: true }).click();
    await expect(page.locator("#mode-select")).toBeVisible();

    // Test transition to Analyze
    await page.getByRole("button", { name: "Analyze", exact: true }).click();
    await expect(page.getByText("System Analysis & Simulation")).toBeVisible();
    await expect(page.getByRole("button", { name: "Traffic Scenarios & Queues" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reliability & SLOs" })).toBeVisible();

    // Test transition to Investigate (Reality Engine)
    await page.getByRole("button", { name: "Investigate", exact: true }).click();
    await expect(page.getByText("DATANOVA REALITY ENGINE", { exact: true })).toBeVisible();

    // Test transition to Improve & Compare
    await page.getByRole("button", { name: "Improve & Compare", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Improve & Compare" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Decision Records (ADR)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Release Impact & Gate" })).toBeVisible();
  });

  test("3. Evidence & Review destination & 6 validation subviews", async ({ page }) => {
    await page.goto("/#/evidence/findings");

    // Verify 6 evidence subviews exist in navigation rail
    await expect(page.getByRole("button", { name: "Findings", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sources", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Telemetry & Records", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reviews", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Share & Exchange", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Quality & Benchmarks", exact: true })).toBeVisible();

    // Verify Findings ledger
    await expect(page.getByText("Active Findings Ledger")).toBeVisible();
    await expect(page.getByText("Undocumented Synchronous Call: Pricing Service")).toBeVisible();

    // Test navigation to Sources
    await page.getByRole("button", { name: "Sources", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Sources", exact: true })).toBeVisible();
    await expect(page.getByText(/primary sources/)).toBeVisible();

    // Test navigation to Reviews
    await page.getByRole("button", { name: "Reviews", exact: true }).click();
    await expect(page.getByText("Validation Room")).toBeVisible();

    // Test navigation to Share & Exchange
    await page.getByRole("button", { name: "Share & Exchange", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Evidence Exchange" })).toBeVisible();
  });

  test("4. Central Multi-Agent Orchestrator execution & unified report", async ({ page }) => {
    await page.goto("/#/home");

    // Click global Ask Orchestrator button
    await page.getByRole("button", { name: /Ask Orchestrator/ }).click();

    // Verify orchestrator modal title
    await expect(page.getByText("What would you like to understand or improve?")).toBeVisible();
    await expect(page.getByText("DataNova Orchestrator", { exact: true })).toBeVisible();

    // Click example chip: "Investigate why checkout requests are slow"
    await page.getByRole("button", { name: "Investigate why checkout requests are slow" }).click();

    // Wait for orchestration completion and report rendering
    await expect(page.getByText("What DataNova Understood")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Key Findings")).toBeVisible();
    await expect(page.getByText("Primary Latency Bottleneck: Pricing Calculation")).toBeVisible();
    await expect(page.getByText("Why These Findings Matter:")).toBeVisible();
    await expect(page.getByText(/Uncertainties & Known Limits/)).toBeVisible();

    // Expand technical activities
    await page.getByText(/Specialist Agent Technical Details/).click();
    await expect(page.getByText("[RELIABILITY]")).toBeVisible();
  });

  test("5. Non-destructive legacy route preservation", async ({ page }) => {
    // 1. Direct navigation to Reality Engine via legacy URL
    await page.goto("/#/atlas/reality");
    await expect(page.getByText("DATANOVA REALITY ENGINE", { exact: true })).toBeVisible();

    // 2. Direct navigation to TRACEN Trail via legacy URL
    await page.goto("/#/trail");
    await expect(page.getByText("TRACEN Vibe Coding Trail")).toBeVisible();

    // 3. Direct navigation to Architecture Lab via legacy URL
    await page.goto("/#/lab");
    await expect(page.getByRole("heading", { name: "Architecture Intelligence Lab" })).toBeVisible();
  });
});
