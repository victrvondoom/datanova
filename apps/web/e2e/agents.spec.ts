/**
 * Campaign 07 E2E — Multi-Agent Workflow Studio: real runs through the actual
 * application. The GPU billing workflow must execute its agents, pause at the
 * human checkpoint, resume on approval, and produce the computed dispute
 * recommendation; the Board, Audit Trail and Infrastructure views must be
 * driven by the persisted run records.
 */

import { test, expect } from "@playwright/test";

const open = async (page: import("@playwright/test").Page): Promise<void> => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/#/atlas/agents");
  await expect(page.getByTestId("agent-studio")).toBeVisible();
};

test("studio loads with the 11 named workflows and honest empty state", async ({ page }) => {
  await open(page);
  const options = page.locator("#wf-select option");
  await expect(options).toHaveCount(11);
  await expect(page.getByText(/Press Run Workflow to start a real execution/)).toBeVisible();
  await expect(page.getByText(/agents · \d+ connections · dataset/).first()).toBeVisible();
});

test("GPU billing audit executes end-to-end with a real human checkpoint", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: /Run Workflow/ }).click();

  // parallel investigation happens on the canvas (running nodes appear)
  await expect(page.locator("text=GPU Lifecycle Auditor").first()).toBeVisible();

  // execution pauses at the human approval checkpoint — the model never finalizes
  const dialog = page.getByRole("dialog", { name: "Human approval required" });
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  await expect(dialog.getByText(/Approve or reject the dispute recommendation/)).toBeVisible();
  await dialog.getByRole("button", { name: /Approve/ }).click();

  // the run completes and reports the run badge
  await expect(page.locator("header").getByText("completed")).toBeVisible({ timeout: 20_000 });

  // the financial result is real: $2,400 supported / $1,200 unsupported of $3,600
  // (select via keyboard — also proves the nonvisual selection path)
  const costNode = page.locator("g[aria-label*='Cost Allocator']").first();
  await costNode.click({ force: true });
  await costNode.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Cost Allocator" })).toBeVisible({ timeout: 10_000 });
  await page.locator("aside details summary").first().click(); // expand the output artifact payload
  await expect(page.getByText(/"supportedAmount": ?2400/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/"unsupportedAmount": ?1200/)).toBeVisible();
});

test("board and audit trail are driven by the persisted run", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: /Run Workflow/ }).click();
  const dialog = page.getByRole("dialog", { name: "Human approval required" });
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  await dialog.getByRole("button", { name: /Approve/ }).click();
  await expect(page.locator("header").getByText("completed")).toBeVisible({ timeout: 20_000 });

  // Board: real task records in status columns
  await page.locator("nav[aria-label='Studio views'] button", { hasText: "Board" }).click();
  await expect(page.getByRole("region", { name: "Task board" })).toBeVisible();
  await expect(page.locator("section[aria-label='Completed column'] button")).toHaveCount(11, { timeout: 10_000 });
  // clicking a task card opens its node in the canvas inspector
  await page.locator("section[aria-label='Completed column'] button", { hasText: "Contract Auditor" }).click();
  await expect(page.getByLabel("Agent inspector")).toBeVisible();

  // Audit trail: immutable chronological events
  await page.locator("nav[aria-label='Studio views'] button", { hasText: "Audit" }).click();
  await expect(page.getByRole("region", { name: "Audit trail" })).toBeVisible();
  await expect(page.getByText("workflow.created")).toBeVisible();
  await expect(page.getByText("agent.handoff.created").first()).toBeVisible();
  await expect(page.getByText("approval.resolved").first()).toBeVisible();
  await expect(page.getByText("workflow.completed").first()).toBeVisible();
});

test("infrastructure map reports honest health: API probed, connectors NOT CONNECTED", async ({ page }) => {
  await open(page);
  await page.locator("nav[aria-label='Studio views'] button", { hasText: "Infrastructure" }).click();
  await expect(page.getByRole("region", { name: "Infrastructure map" })).toBeVisible();
  // connectors are honestly not configured
  await expect(page.getByText("NOT CONNECTED").first()).toBeVisible();
  await expect(page.getByText("no inference endpoint configured", { exact: false })).toBeVisible();
  // the API probe actually ran and reports a real state
  await expect(page.getByText(/HEALTHY|OFFLINE/).first()).toBeVisible();
});

test("invoice passport run holds the suspicious invoice and skips nothing silently", async ({ page }) => {
  await open(page);
  await page.locator("#wf-select").selectOption("wf-invoice-passport");
  await page.getByRole("button", { name: /Run Workflow/ }).click();
  const dialog = page.getByRole("dialog", { name: "Human approval required" });
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByText(/must not book on model opinion alone/)).toBeVisible();
  await dialog.getByRole("button", { name: /Reject/ }).click();
  await expect(page.locator("header").getByText("completed")).toBeVisible({ timeout: 20_000 });
  // the rejection consequence is recorded honestly
  await page.locator("nav[aria-label='Studio views'] button", { hasText: "Audit" }).click();
  await expect(page.getByText("action.rejected").first()).toBeVisible();
});
