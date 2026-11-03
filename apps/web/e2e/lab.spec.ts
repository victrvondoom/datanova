import { test, expect } from "@playwright/test";

/**
 * Architecture Intelligence Lab (campaign 03) — user-flow E2E against the
 * production build (vite preview on 4173). Verifies the required journey:
 * open the lab -> inspect intent coverage on the canvas -> inject a failure
 * and read the causal chain -> inspect the blast radius -> run a chaos
 * experiment with a verdict -> replay the flight recorder -> record an ADR
 * from the debate -> run the capstone and read the evidence package ->
 * persistence across reload -> reset works.
 */

const LAB_TAB = "Architecture Lab";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
});

test("lab opens with canvas, intent coverage, and grounded explanations", async ({ page }) => {
  await page.goto("#/lab");
  await expect(page.getByRole("heading", { name: "Architecture Intelligence Lab" })).toBeVisible();
  await expect(page.getByText("DocFlow (document-processing SaaS)", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Architecture canvas", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Intent coverage", { exact: false })).toBeVisible();
  // grounded explanation for a selected component
  await page.getByRole("button", { name: "Work queue" }).click();
  await expect(page.getByText(/Buffers processing work/).first()).toBeVisible();
});

test("causality: inject meta-db failure, read causal chain and blast radius", async ({ page }) => {
  await page.goto("#/lab/causality");
  await expect(page.getByText("Failure injection")).toBeVisible();
  await page.getByLabel("Failed component:").selectOption("meta-db");
  // blast radius names the impacted user-visible operations
  await expect(page.getByText("Upload document", { exact: false }).first()).toBeVisible();
  // the causal explanation names the rule that fired
  await expect(page.getByText(/R-SYNC-BLOCK/).first()).toBeVisible();
  // genome fingerprint present
  await expect(page.getByText(/Fingerprint gn-/).first()).toBeVisible();
});

test("experiments: chaos verdict, flight recorder replay, and package round-trip", async ({ page }) => {
  await page.goto("#/lab/experiments");
  await expect(page.getByText("Chaos experiment designer")).toBeVisible();
  // default experiment targets meta-db with all ops expected: supported
  await expect(page.getByText("Verdict: SUPPORTED")).toBeVisible();
  // flight recorder controls
  await expect(page.getByLabel(/seq 1/).first()).toBeVisible();
  await page.getByRole("button", { name: "Skip to end" }).click();
  await expect(page.getByText(/meta-db:/).first()).toBeVisible();
  // export + reproduce a package
  await page.getByRole("button", { name: "Export current experiment" }).click();
  await page.getByRole("button", { name: "Import + reproduce" }).click();
  await expect(page.getByText(/Reproduced: verdict=supported/).first()).toBeVisible();
});

test("review: critic findings, scorecard, debate decision, and mission", async ({ page }) => {
  await page.goto("#/lab/review");
  await expect(page.getByText("Architecture critic")).toBeVisible();
  await expect(page.getByText(/rules fired:/).first()).toBeVisible();
  await expect(page.getByText("Resilience scorecard")).toBeVisible();
  await expect(page.getByText(/no aggregate score/i).first()).toBeVisible();
  // record a decision from the debate
  await page.getByRole("button", { name: "Record decision as ADR" }).click();
  await expect(page.getByText(/Decision log:/).first()).toBeVisible();
  // mission evaluation is visible and honest about the seeded gaps
  await expect(page.getByText(/Evaluation:/).first()).toBeVisible();
});

test("capstone: run the lifecycle and read the evidence package", async ({ page }) => {
  await page.goto("#/lab/capstone");
  await page.getByRole("button", { name: "Run the capstone lifecycle" }).click();
  await expect(page.getByText("Requirement coverage")).toBeVisible();
  await expect(page.getByText(/Open questions and limitations/).first()).toBeVisible();
  await expect(page.getByText(/Intelligence benchmark/).first()).toBeVisible();
  // benchmark report is rendered from an executed run (all ground truth found)
  await expect(page.getByText(/precision 1, recall 1/).first()).toBeVisible();
  await expect(page.getByText(/unsupported-claim rate 0/).first()).toBeVisible();
});

test("lab state persists across reload and reset works", async ({ page }) => {
  await page.goto("#/lab");
  await page.getByLabel("Mode").selectOption("expert");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Architecture Intelligence Lab" })).toBeVisible();
  await expect(page.getByLabel("Mode")).toHaveValue("expert");
  // deep link to a panel still works after reload
  await page.goto("#/lab/security");
  await expect(page.getByText("Trust boundaries")).toBeVisible();
  await page.getByRole("button", { name: "Reset the lab to the default architecture" }).click();
  await expect(page.getByLabel("Mode")).toHaveValue("intermediate");
});
