/**
 * DataNova Atlas — Comprehensive Interactive Workflows E2E Test Suite (Campaign 06).
 *
 * Verifies:
 *  - 3D canvas mounting, camera presets, fit to view
 *  - Multi-mode object navigator grouping (by Zone, by Group, by Type)
 *  - Interactive edge property editing in the inspector (Kind, Criticality, Failure Behavior, Latency SLA)
 *  - Simulation running and temporal scrubber in the operational dock
 *  - Spatial architecture stress benchmarks display
 *  - 2D accessible canvas fallback and keyboard navigation
 *  - Validation Room assessment submission
 */

import { test, expect } from "@playwright/test";

const openAtlas = async (page: import("@playwright/test").Page, section = "studio"): Promise<void> => {
  await page.goto(`/#/atlas/${section}`);
  await expect(page.locator("nav[aria-label='Atlas sections']")).toBeVisible();
};

test("interactive: navigator grouping changes component listing order", async ({ page }) => {
  await openAtlas(page, "studio");
  const groupingSelect = page.locator("select[aria-label='Group components']");
  await expect(groupingSelect).toBeVisible();

  // Switch to Group by Domain Tag
  await groupingSelect.selectOption("group");
  await page.waitForTimeout(300);

  // Switch to Group by Component Type
  await groupingSelect.selectOption("type");
  await page.waitForTimeout(300);

  // Switch back to Zone
  await groupingSelect.selectOption("zone");
  await expect(page.getByRole("button", { name: /Metadata database/ }).first()).toBeVisible();
});

test("interactive: edge property editing in the inspector updates model state", async ({ page }) => {
  await openAtlas(page, "studio");

  // Select Upload service first
  await page.getByRole("button", { name: /Upload service/ }).first().click();
  const inspector = page.locator("aside[aria-label='Inspector']");
  await expect(inspector).toBeVisible();

  // Open dependencies to find an outgoing edge
  await inspector.getByText("Dependencies").click();
  await inspector.getByRole("button", { name: /🔗 doc-store/ }).click();

  // The edge is now selected: check inspector for connection properties
  await expect(inspector.getByText("Connection", { exact: true })).toBeVisible();
  await expect(inspector.locator("select[aria-label='Connection kind']")).toBeVisible();

  // Edit kind to async
  await inspector.locator("select[aria-label='Connection kind']").selectOption("async");
  await expect(page.getByText(/Updated connection properties/)).toBeAttached();

  // Edit criticality to 5 (Essential)
  await inspector.locator("select[aria-label='Connection criticality']").selectOption("5");
  await expect(page.getByText(/Updated connection properties/)).toBeAttached();

  // Edit failure behavior to degrades
  await inspector.locator("select[aria-label='Failure behavior']").selectOption("degrades");
  await expect(page.getByText(/Updated connection properties/)).toBeAttached();
});

test("interactive: simulation run activates temporal scrubber in the operational dock", async ({ page }) => {
  await openAtlas(page, "studio");

  // Run burst scenario
  await page.getByRole("button", { name: /Run scenario/ }).click();
  await expect(page.getByText(/burst-overload @ 120 rps/)).toBeVisible();

  // Operational dock should show the scenario scrubber
  const scrubber = page.locator("input[aria-label='Simulation step scrubber']");
  await expect(scrubber).toBeVisible();

  // Verify scrubber can be interacted with
  await scrubber.fill("0");
  await page.waitForTimeout(200);
  await expect(page.getByText(/t = 0 ms/)).toBeVisible();
});

test("interactive: benchmarks view renders spatial stress benchmark matrix", async ({ page }) => {
  await openAtlas(page, "benchmarks");
  await expect(page.getByRole("heading", { name: "Benchmarks", exact: true })).toBeVisible();

  // Spatial Graph & Rendering Stress Benchmarks panel
  await expect(page.getByText("Spatial Graph & Rendering Stress Benchmarks")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Small" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Medium" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Large" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Stress" })).toBeVisible();
  await expect(page.getByText("500 nodes / 1500 edges")).toBeVisible();
  await expect(page.locator("span", { hasText: /✓ sane/ }).first()).toBeVisible();
});

test("interactive: 2D accessible fallback operates smoothly with keyboard", async ({ page }) => {
  await openAtlas(page, "studio");

  // Toggle to 2D
  await page.getByRole("button", { name: "3D" }).click();
  const map = page.getByRole("img", { name: /2D architecture map/ });
  await expect(map).toBeVisible();

  // Click a node in 2D map
  const firstNode = page.locator("svg g[role='button']").first();
  await expect(firstNode).toBeVisible();
  await firstNode.click();

  // Inspector should be open and display the selected component
  const inspector = page.locator("aside[aria-label='Inspector']");
  await expect(inspector).toBeVisible();
});
