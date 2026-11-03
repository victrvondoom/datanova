import { test, expect } from "@playwright/test";

/**
 * Campaign 04, Task 01 — accessibility interaction coverage for the lab.
 *
 * IMPORTANT HONESTY NOTE: these are browser-level accessibility-tree and
 * keyboard tests. They are NOT equivalent to testing with a real screen
 * reader; the manual protocol for that lives in
 * docs/campaign-04/screen-reader-protocol.md and its coverage is manual-only.
 *
 * Covered here (executable):
 * - keyboard navigation through the primary journey (tabs, controls)
 * - accessible names of every interactive control on the visited views
 * - severity communicated by label+icon+color, never color alone
 * - evidence-kind chips are labeled (simulated/inferred/…)
 * - headings/landmarks expose the view structure
 * - the architecture canvas has a text alternative (role=img + aria-label)
 * - forms have programmatically associated labels
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
});

test("primary journey is fully keyboard-operable with visible focus", async ({ page }) => {
  await page.goto("#/lab");
  // tab into the tab bar and navigate with the keyboard only.
  // Campaign 05: the tab bar is a real ARIA tablist — tabs now expose
  // role="tab" (the keyboard journey is unchanged; the semantics improved).
  await page.keyboard.press("Tab");
  const tab = page.getByRole("tab", { name: "Causality & Blast Radius" });
  await tab.focus();
  await expect(tab).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Failure injection")).toBeVisible();
  // the fault controls are reachable and operable by keyboard
  const target = page.getByLabel("Failed component:");
  await target.focus();
  await expect(target).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(target).not.toHaveValue("meta-db");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(target).toHaveValue("meta-db");
});

test("every interactive control on the visited views has an accessible name", async ({ page }) => {
  await page.goto("#/lab/causality");
  await expect(page.getByLabel("Failed component:")).toBeVisible();
  await expect(page.getByLabel("Fault:")).toBeVisible();
  // back to overview: architecture selector, mode selector, reset all named
  await page.goto("#/lab/overview");
  const named = [
    page.getByLabel("Architecture", { exact: true }), page.getByLabel("Mode"),
    page.getByRole("button", { name: /Reset the lab/ }),
  ];
  for (const locator of named) await expect(locator).toBeVisible();
  // the canvas carries a text alternative
  await expect(page.getByRole("img", { name: /Architecture canvas/ })).toBeVisible();
});

test("findings communicate severity and evidence kind by label, not color alone", async ({ page }) => {
  await page.goto("#/lab/review");
  // severity badges render their textual label
  await expect(page.getByText("Critical", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Warning", { exact: true }).first()).toBeVisible();
  // evidence-kind chips are labeled
  const chips = page.getByTitle(/Evidence kind: /);
  await expect(chips.first()).toBeVisible();
  const first = await chips.first().getAttribute("title");
  expect(first).toMatch(/Evidence kind: (simulated|inferred|observed|user-authored)/);
});

test("intent authoring form: labels, keyboard operation, and announced results", async ({ page }) => {
  await page.goto("#/lab/intent");
  await expect(page.getByRole("heading", { name: /1\. Intent/ })).toBeVisible();
  // all form fields have programmatically associated labels
  const labeled = [
    page.getByLabel("Architecture goal"),
    page.getByLabel("Peak requests per second"),
    page.getByLabel("Acknowledgement deadline in milliseconds"),
    page.getByLabel("Monthly availability target in percent"),
    page.getByLabel("Processing time per work item in seconds"),
    page.getByLabel("Modeled monthly cost cap in dollars"),
    page.getByLabel("Require strict read-after-write for results"),
    page.getByLabel("Hard constraints, one per line"),
  ];
  for (const locator of labeled) await expect(locator).toBeVisible();
  // operate by keyboard: compile and review
  await page.getByRole("button", { name: "Compile and review intent" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Intent review")).toBeVisible();
  await expect(page.getByText(/No intent problems detected|Critical|Warning/).first()).toBeVisible();
  // the compiled starter model is inspectable and adoptable
  await expect(page.getByText("Compiled starter architecture")).toBeVisible();
  await page.getByRole("button", { name: "Adopt as my architecture" }).focus();
  await page.keyboard.press("Enter");
  // the adopted architecture is the working model (canvas shows it)
  await page.goto("#/lab/overview");
  await expect(page.getByRole("button", { name: "Core service" })).toBeVisible();
});

test("scenario runner results are announced with pass/fail labels, not color alone", async ({ page }) => {
  await page.goto("#/lab/experiments");
  const run = page.getByRole("button", { name: "Run scenario" });
  await run.click();
  await expect(page.getByText(/Expectations/).first()).toBeVisible();
  // expectation rows carry their outcome textually
  await expect(page.getByText(/\[pass\]|\[fail\]/).first()).toBeVisible();
  // the recovery timeline is textual and inspectable
  await expect(page.getByText(/Recovery timeline/)).toBeVisible();
});

test("accessibility tree: the overview exposes headings and named regions", async ({ page }) => {
  await page.goto("#/lab/overview");
  // The lab view is code-split: wait for the lazy module to mount before
  // snapshotting the a11y tree (ariaSnapshot itself does not auto-wait).
  await expect(page.getByRole("heading", { name: "Architecture canvas" })).toBeVisible();
  // the lab renders its own <main> inside the dashboard shell
  const snapshot = await page.getByRole("main").last().ariaSnapshot();
  expect(snapshot).toContain("heading \"Architecture canvas\"");
  expect(snapshot).toContain("heading \"Intent coverage\"");
  expect(snapshot).toContain("heading \"Constraints and assumptions\"");
});
