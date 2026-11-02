import { test, Page } from "@playwright/test";

/**
 * Evidence capture (opt-in): STUDIO_EVIDENCE=1 npx playwright test e2e/studio-evidence.spec.ts
 * Writes screenshots to docs/studio-evidence/. Skipped by default because it produces artifacts, not assertions;
 * the behaviour itself is asserted in studio.spec.ts.
 */
const OUT = "../../docs/studio-evidence";
test.skip(!process.env.STUDIO_EVIDENCE, "evidence capture is opt-in (set STUDIO_EVIDENCE=1)");
test.use({ colorScheme: "dark", viewport: { width: 1440, height: 900 } });

const shot = async (page: Page, name: string) => page.screenshot({ path: `${OUT}/${name}.png`, animations: "disabled" });

test("capture evidence screenshots", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.goto("/#/studio");
  await shot(page, "01-scenarios");
  await page.getByTestId("scenario-pdf-saas").getByRole("button", { name: "Improve a first draft" }).click();
  await page.waitForTimeout(300);
  await shot(page, "02-design-canvas");
  await page.getByRole("link", { name: "Requirements", exact: true }).click();
  await page.getByTestId("req-pdf-r3").click();
  await shot(page, "03-requirements-map");
  await page.getByRole("link", { name: "Validate", exact: true }).click();
  await page.getByTestId("finding-payment-no-idempotency").waitFor(); // critical findings start expanded
  await shot(page, "04-validation");
  await page.getByRole("link", { name: "Capacity", exact: true }).click();
  await shot(page, "05-capacity");
  await page.getByRole("link", { name: "Failure Lab", exact: true }).click();
  await page.getByLabel("Failure", { exact: true }).selectOption("api-timeout");
  await page.getByRole("button", { name: "Inject failure" }).click();
  await page.waitForTimeout(300);
  await shot(page, "06-failure-lab-unprotected");
  await page.getByRole("link", { name: "Compare", exact: true }).click();
  await page.getByLabel("Version A").selectOption({ label: "Built-in: naive first draft" });
  await page.getByLabel("Version B").selectOption({ label: "Built-in: worked example (one valid design)" });
  await shot(page, "07-compare");
  await page.getByRole("link", { name: "Review", exact: true }).click();
  await page.getByRole("button", { name: "Generate review" }).click();
  await shot(page, "08-review");
  await page.goto("/#/studio");
  await page.getByTestId("scenario-payments-rewards").getByRole("button", { name: "Guided challenge" }).click();
  await shot(page, "09-challenge");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/#/studio/design");
  await page.getByTestId("canvas").waitFor();
  await shot(page, "10-mobile-design");
});
