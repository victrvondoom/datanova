/**
 * Campaign 07 — visual review capture for the Workflow Studio: screenshots of
 * the canvas mid-run, board, audit trail and infrastructure map, saved to
 * docs/workflow-studio/screens/ for inspection against the design goals.
 */
import { test, expect } from "@playwright/test";
import * as fs from "node:fs";

const OUT = "docs/workflow-studio/screens";

const shoot = async (page: import("@playwright/test").Page, name: string): Promise<void> => {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
};

test.beforeAll(() => { fs.mkdirSync(OUT, { recursive: true }); });

test("visual review: capture the workflow studio screens", async ({ page }) => {
  page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => window.localStorage.clear());

  // empty state
  await page.goto("/#/atlas/agents");
  await page.getByTestId("agent-studio").waitFor();
  await page.waitForTimeout(500);
  await shoot(page, "01-studio-empty-state");

  // canvas mid-run
  await page.getByRole("button", { name: /Run Workflow/ }).click();
  await page.waitForTimeout(2500);
  await shoot(page, "02-canvas-running");

  // human checkpoint dialog
  const dialog = page.getByRole("dialog", { name: "Human approval required" });
  await dialog.waitFor({ timeout: 20_000 });
  await shoot(page, "03-human-checkpoint");
  await dialog.getByRole("button", { name: /Approve/ }).click();
  await page.waitForTimeout(1200);
  await shoot(page, "04-canvas-approved");

  // completed canvas + inspector on the Cost Allocator
  await expect(page.locator("header").getByText("completed")).toBeVisible({ timeout: 20_000 });
  await page.locator("g[aria-label*='Cost Allocator']").first().click();
  await page.waitForTimeout(500);
  await shoot(page, "05-inspector-agent");

  // board
  await page.locator("nav[aria-label='Studio views'] button", { hasText: "Board" }).click();
  await page.waitForTimeout(500);
  await shoot(page, "06-board");

  // audit trail
  await page.locator("nav[aria-label='Studio views'] button", { hasText: "Audit" }).click();
  await page.waitForTimeout(500);
  await shoot(page, "07-audit-trail");

  // infrastructure map
  await page.locator("nav[aria-label='Studio views'] button", { hasText: "Infrastructure" }).click();
  await page.waitForTimeout(1200);
  await shoot(page, "08-infrastructure-map");

  // responsive
  await page.setViewportSize({ width: 1024, height: 700 });
  await page.locator("nav[aria-label='Studio views'] button", { hasText: "Canvas" }).click();
  await page.waitForTimeout(600);
  await shoot(page, "09-responsive-studio");

  expect(fs.existsSync(`${OUT}/02-canvas-running.png`)).toBe(true);
});
