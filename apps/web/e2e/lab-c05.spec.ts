/**
 * Campaign 05 E2E — the two-user evidence-exchange capstone (Task 41) and
 * accessibility coverage for the new surfaces (Tasks 03/04/05/19).
 *
 * Two independent browser contexts play Architect A and Reviewer B:
 * export -> validate -> receive -> inspect -> accept (staged) -> annotate ->
 * respond -> author-side response import, with provenance visible at every
 * step. All against the offline preview build (API stopped).
 */

import { test, expect, type Browser, type Page } from "@playwright/test";

const gotoExchange = async (page: Page): Promise<void> => {
  await page.goto("/#/lab/exchange");
  await expect(page.getByRole("heading", { name: "Architecture Intelligence Lab" })).toBeVisible();
};

const freshContextPage = async (browser: Browser): Promise<Page> => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await gotoExchange(page);
  return page;
};

test("two-user capstone: export -> import -> review -> response with provenance", async ({ browser }) => {
  // ---------- User A: build and export ----------
  const a = await freshContextPage(browser);
  await a.getByLabel("Your name (self-declared — attribution only, not verified identity)").fill("Architect A");
  await a.getByRole("button", { name: "Build and export package" }).click();
  const exported = a.locator("#exported-json");
  await expect(exported).toBeVisible();
  const pkgJson = (await exported.inputValue()).trim();
  expect(pkgJson).toMatch(/"format":"datanova-evidence-package"/);
  // the polite live region announced the export (screen-reader parity)
  await expect(a.getByRole("status").first()).toContainText(/Package exported: dep-/);
  // the outbox records the exported item
  await expect(a.getByText(/dep-[0-9a-f]{8} — exported/).first()).toBeVisible();

  // ---------- User B: validate, receive, inspect, accept (staged) ----------
  const b = await freshContextPage(browser);
  await b.getByLabel("Paste a Datanova evidence package (JSON)").fill(pkgJson);
  await b.getByRole("button", { name: "Validate" }).click();
  await expect(b.getByText(/Valid package\. dep-/)).toBeVisible();
  await b.getByRole("button", { name: "Receive into inbox" }).click();
  await expect(b.getByText(/— status: received/)).toBeVisible();
  await b.getByRole("button", { name: "Inspect" }).click();
  await b.getByRole("button", { name: "Accept (staged)" }).click();
  await expect(b.getByText(/— status: accepted/)).toBeVisible();
  await expect(b.getByRole("status").first()).toContainText(/staged as the working architecture/);
  // the inbox filter shows pending vs closed packages (Task 35.3)
  await b.getByLabel("Filter").selectOption("pending");
  await expect(b.getByText(/— status: accepted/)).toHaveCount(0);
  await b.getByLabel("Filter").selectOption("closed");
  await expect(b.getByText(/— status: accepted/)).toBeVisible();

  // ---------- User B: annotate the received package ----------
  await b.getByRole("button", { name: "Review", exact: true }).click();
  await b.getByLabel("Annotation target").fill("component:meta-db");
  await b.getByLabel("Comment").fill("Why single writer for the metadata store?");
  await b.getByRole("button", { name: "Add annotation" }).click();
  await expect(b.getByText("Why single writer for the metadata store?")).toBeVisible();
  // resolve with a response, keeping history
  await b.getByRole("button", { name: "Resolve" }).click();
  await expect(b.getByText(/1 response\(s\)/)).toBeVisible();

  // ---------- User B: export the review response and return it ----------
  const [download] = await Promise.all([
    b.waitForEvent("download"),
    b.getByRole("button", { name: "Export review response" }).click(),
  ]);
  const responsePath = await download.path();
  if (!responsePath) throw new Error("response download produced no file");
  const { readFileSync } = await import("node:fs");
  const responseJson = readFileSync(responsePath, "utf-8");
  expect(responseJson).toMatch(/"format":"datanova-review-response"/);

  // ---------- User A: import the returned response ----------
  await a.getByLabel("Paste a review response (JSON)").fill(responseJson);
  await a.getByRole("button", { name: "Import response" }).click();
  await expect(a.getByRole("status").first()).toContainText(/1 annotation\(s\)/);

  // ---------- provenance chain visible on both sides ----------
  await expect(a.getByText("A exported package")).toBeVisible();
  await expect(a.getByText(/responded/)).toBeVisible();
  await expect(b.getByText(/imported package/)).toBeVisible();
});

test("tampered packages are rejected in isolation, workspace untouched", async ({ browser }) => {
  const b = await freshContextPage(browser);
  const tampered = JSON.stringify({ format: "datanova-evidence-package", schemaVersion: 99, evil: true });
  await b.getByLabel("Paste a Datanova evidence package (JSON)").fill(tampered);
  await b.getByRole("button", { name: "Validate" }).click();
  await expect(b.getByText(/Rejected \(/)).toBeVisible();
  await expect(b.getByText(/newer than supported|upgrade Datanova/).first()).toBeVisible();
  // receive remains disabled — nothing was staged
  await expect(b.getByRole("button", { name: "Receive into inbox" })).toBeDisabled();
});

test("accessibility: exchange panel is keyboard-operable with announced results and labeled controls", async ({ page }) => {
  await gotoExchange(page);
  // every control on the exchange tab has an accessible name (label or aria-label)
  const unlabeled = await page.evaluate(() => {
    const controls = window.document.querySelectorAll<HTMLElement>("#root button, #root input:not([type=hidden]), #root textarea, #root select");
    const missing: string[] = [];
    controls.forEach((el) => {
      const name = el.getAttribute("aria-label") ?? (el as HTMLInputElement).labels?.[0]?.textContent ?? el.textContent ?? "";
      if (!name.trim()) missing.push(el.outerHTML.slice(0, 80));
    });
    return missing;
  });
  expect(unlabeled).toEqual([]);
  // the tab bar is an ARIA tablist with roving arrow-key navigation
  const tabs = page.getByRole("tab");
  await expect(tabs.first()).toBeVisible();
  await page.locator('[role="tab"][data-tab="intent"]').click();
  await expect(page.locator('[role="tab"][data-tab="intent"]')).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[role="tab"][data-tab="overview"]')).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[role="tab"][data-tab="overview"]')).toBeFocused();
  // roving focus navigates back just as cleanly
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator('[role="tab"][data-tab="intent"]')).toBeFocused();
  // dynamic results are announced politely (compile announces problem counts)
  await page.getByRole("button", { name: "Compile and review intent" }).click();
  await expect(page.getByRole("status").first()).toContainText(/Intent compiled: \d+ problem\(s\)/);
  // repeating the identical action does not re-announce unchanged content:
  // the live region keeps its message and gains no duplicates
  const statusText = await page.getByRole("status").first().textContent();
  await page.getByRole("button", { name: "Compile and review intent" }).click();
  await expect(page.getByRole("status").first()).toHaveText(statusText ?? "");
  // failed requests are announced too: a malformed import reports its rejection
  await page.goto("/#/lab/exchange");
  await page.getByLabel("Paste a Datanova evidence package (JSON)").fill("{not-a-package");
  await page.getByRole("button", { name: "Validate" }).click();
  await expect(page.getByRole("status").first()).toContainText(/Import rejected with \d+ problem\(s\)/);
});

test("accessibility: nonvisual summary, grounded explanations, and validity dashboard render with text", async ({ page }) => {
  await page.goto("/#/lab/overview");
  await expect(page.getByText("Nonvisual architecture summary")).toBeVisible();
  await expect(page.getByText(/components across \d+ trust zones/).first()).toBeVisible();
  await page.locator("details").first().click();
  await expect(page.getByText(/Connection: .+ to .+, (synchronous|asynchronous|event), /).first()).toBeVisible();

  await page.goto("/#/lab/review");
  await expect(page.getByText("Grounded explanations")).toBeVisible();
  await expect(page.getByText(/\[grounded\]|\[internal-model\]/).first()).toBeVisible();
  await expect(page.getByText(/Release It!|RFC|Builders' Library/).first()).toBeVisible();

  await page.goto("/#/lab/capstone");
  await expect(page.getByText("Benchmark validity dashboard")).toBeVisible();
  await expect(page.getByText(/\[not-yet-validated\]/).first()).toBeVisible();
  await expect(page.getByText(/PROTOCOL READY — NOT EXECUTED|MISSING validation/).first()).toBeVisible();
});
