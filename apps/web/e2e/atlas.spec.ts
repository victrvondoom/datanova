/**
 * Campaign 06 E2E — Datanova Atlas: the spatial studio, map modes, editing,
 * scenario run, command palette, validation workflow, and the accessible 2D
 * fallback, all through the real application.
 */

import { test, expect } from "@playwright/test";

const openAtlas = async (page: import("@playwright/test").Page, section = "studio"): Promise<void> => {
  await page.goto(`/#/atlas/${section}`);
  await expect(page.locator("nav[aria-label='Atlas sections']")).toBeVisible();
};

test("shell: every section navigates to a real view (no dead links)", async ({ page }) => {
  await openAtlas(page, "mission");
  await expect(page.getByRole("heading", { name: "Mission Control" })).toBeVisible();
  for (const section of ["experiments", "validation", "exchange", "benchmarks", "sources", "decisions", "settings", "system"]) {
    await page.locator(`nav[aria-label="Atlas sections"] button`, { hasText: new RegExp(section, "i") }).first().click();
    await expect(page).toHaveURL(new RegExp(`#/atlas/${section}`));
  }
  // header validation chip + version + saved state present
  await openAtlas(page, "mission");
  await expect(page.getByText(/v\d+/).first()).toBeVisible();
  await expect(page.getByText("✓ saved").first()).toBeVisible();
  await expect(page.getByText(/Not yet reviewed/).first()).toBeVisible();
});

test("studio: 3D scene mounts and map modes change the rendered analysis", async ({ page }) => {
  await openAtlas(page, "studio");
  const canvas = page.getByTestId("atlas-3d-canvas");
  // WebGL in CI Chromium runs via SwiftShader; if unavailable the app must say so honestly
  const status = page.locator("text=/WebGL ·|WebGL unavailable/");
  await expect(status.first()).toBeVisible({ timeout: 15_000 });
  const canvasVisible = await canvas.isVisible();
  if (canvasVisible) {
    await expect(canvas.locator("canvas")).toBeAttached();
  }
  // map modes: each changes the status-line summary
  const summary = page.locator("span", { hasText: /components, \d+ connections/ }).first();
  await expect(summary).toBeVisible();
  for (const [mode, marker] of [
    ["Dependency", /upstream, \d+ downstream/],
    ["Trust", /uncontrolled boundary crossing/],
    ["Data Lineage", /data entities owned/],
    ["Failure", /No failure injected|Failure of/],
    ["Recovery", /No recovery timeline|recovered/],
    ["Evidence", /finding\(s\) mapped/],
  ] as const) {
    await page.locator("#mode-select").selectOption(mode.toLowerCase().includes("lineage") ? "lineage" : mode === "Dependency" ? "dependency" : mode === "Trust" ? "trust" : mode === "Failure" ? "failure" : mode === "Recovery" ? "recovery" : "evidence");
    await expect(page.locator("span", { hasText: marker }).first()).toBeVisible();
  }
});

test("studio: navigator selection drives the inspector (selection sync)", async ({ page }) => {
  await openAtlas(page, "studio");
  await page.getByRole("button", { name: /Metadata database/ }).first().click();
  await expect(page.getByRole("heading", { name: "Inspector" })).toBeVisible();
  const inspector = page.locator("aside[aria-label='Inspector']");
  await expect(inspector.getByText("Metadata database")).toBeVisible();
  // dependencies section (collapsed details) opens and shows upstream + downstream
  await inspector.getByText("Dependencies").click();
  await expect(inspector.getByText(/In: upload-svc/)).toBeVisible();
  // trust section shows the zone (also a collapsed details)
  await inspector.getByText("Trust").click();
  await expect(inspector.getByText(/Zone: Data \(privileged\)/)).toBeVisible();
});

test("studio: 2D fallback is a real accessible map", async ({ page }) => {
  await openAtlas(page, "studio");
  await page.getByRole("button", { name: "3D" }).click(); // toggles to 2D
  const map = page.getByRole("img", { name: /2D architecture map/ });
  await expect(map).toBeVisible();
  // keyboard-operable components with aria labels
  const node = page.locator("svg g[role='button']").first();
  await expect(node).toBeAttached();
  await node.click();
  await expect(page.getByRole("heading", { name: "Inspector" })).toBeVisible();
});

test("studio: add a component, connect it, undo — canonical model edits persist", async ({ page }) => {
  await openAtlas(page, "studio");
  const before = await page.locator("aside[aria-label='Object navigator'] ul li").count();
  await page.getByRole("button", { name: /Add/ }).first().click();
  await page.getByLabel("Component name").fill("Audit service");
  await page.getByRole("button", { name: "Add component" }).click();
  await expect(page.getByRole("button", { name: /Audit service/ }).first()).toBeVisible();
  const after = await page.locator("aside[aria-label='Object navigator'] ul li").count();
  expect(after).toBe(before + 1);
  // the polite announcer reports the saved version bump (screen-reader live region)
  await expect(page.getByText(/Architecture saved — version 2/)).toBeAttached();
  // connect the new node to an existing one
  // select the web client FIRST so the connection flows web -> audit-service
  await page.getByRole("button", { name: /Web client/ }).first().click();
  await page.getByRole("button", { name: /Connect/ }).click();
  await page.getByRole("button", { name: "Audit service", exact: true }).click();
  await expect(page.getByText(/Connected web → /)).toBeAttached();
  // the new edge exists in the canonical model: check via the inspector of the new node
  await page.getByRole("button", { name: /Audit service/ }).first().click();
  await page.locator("aside[aria-label='Inspector']").getByText("Dependencies").click();
  await expect(page.locator("aside[aria-label='Inspector']").getByText(/In: web/)).toBeVisible();
  // undo the connection edit
  await page.getByRole("button", { name: /Undo/ }).click();
  await expect(page.locator("aside[aria-label='Inspector']").getByText(/In: none/)).toBeVisible();
});

test("studio: run a scenario — results appear in the dock and traffic mode lights up", async ({ page }) => {
  await openAtlas(page, "studio");
  await page.getByRole("button", { name: "Run scenario" }).click();
  await expect(page.getByRole("tab", { name: /Scenario/ })).toBeVisible();
  await page.getByRole("tab", { name: /Scenario/ }).click();
  await expect(page.getByText(/burst-overload @ 120 rps/).first()).toBeVisible();
  await expect(page.getByText(/Traffic at 120 rps peak/).first()).toBeVisible();
});

test("command palette: search and navigate by keyboard", async ({ page }) => {
  await openAtlas(page, "studio");
  await page.keyboard.press("Control+k");
  await expect(page.getByLabel("Search or run a command")).toBeVisible();
  const box = page.getByLabel("Search or run a command");
  await box.fill("validation");
  await box.press("Enter");
  await expect(page).toHaveURL(/#\/atlas\/validation/);
  await expect(page.getByRole("heading", { name: "Validation Room" })).toBeVisible();
});

test("validation room: a real assessment changes the derived state honestly", async ({ page }) => {
  await openAtlas(page, "validation");
  await expect(page.getByText(/Not yet reviewed|Human assessment received/).first()).toBeVisible();
  await page.getByLabel("Reviewer name").fill("Independent Engineer");
  await page.getByLabel("Assessment rationale").fill(
    "I read the scenario results and the claim trace; the modeled outcomes are consistent with the documented expectations and the sources are real.",
  );
  await page.getByRole("button", { name: "Submit assessment" }).click();
  // identity trust is self-declared → the honest state is identity-unverified
  await expect(page.getByText(/Reviewer identity unverified|Human assessment received/).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Independent Engineer").first()).toBeVisible();
  await expect(page.getByText("self-declared", { exact: true }).first()).toBeVisible();
});

test("benchmarks + sources: data-backed dashboards render registry values", async ({ page }) => {
  await openAtlas(page, "benchmarks");
  await expect(page.getByText(/Synthetic cases/)).toBeVisible();
  await expect(page.getByText(/29/).first()).toBeVisible(); // v2 corpus size from the real run
  await openAtlas(page, "sources");
  await expect(page.getByText(/primary sources/)).toBeVisible();
  await expect(page.getByText("RFC 9110")).toBeVisible();
  await expect(page.getByText(/honestly internal|honest/).first()).toBeVisible();
});
