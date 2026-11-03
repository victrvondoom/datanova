import { test, expect } from "@playwright/test";

/**
 * Accessibility & visual-regression coverage for the trail.
 *
 * 1. prefers-reduced-motion: the continuously animated bars (token-bucket
 *    fill, progress bar) must drop their CSS transitions when the user
 *    prefers reduced motion.
 * 2. Visual baselines: pixel-diff snapshots of the two most important
 *    screens. Baselines live in e2e/__snapshots__/trail-a11y.spec.ts/ and
 *    are regenerated with `npx playwright test --update-snapshots`.
 */

test("prefers-reduced-motion disables bar animations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/trail/topic/01");

  const bucketBar = page.locator('div[class*="bg-sky-400/70"]').first();
  await expect(bucketBar).toBeVisible();
  // motion-reduce:transition-none sets transition-property: none
  const transitionProperty = await bucketBar.evaluate((el) => getComputedStyle(el).transitionProperty);
  expect(transitionProperty).toBe("none");

  // and the landing progress bar as well
  await page.goto("/#/trail");
  await page.evaluate(() => window.localStorage.setItem("tracen-trail-progress-v1", JSON.stringify({ visited: [1, 2], simInteracted: [], completed: [1, 2], quiz: {}, finalQuiz: {}, finalQuizCompleted: false, caseStudyCompleted: false, lastTopic: 2 })));
  await page.reload();
  await page.getByText("Vibe Coding Trail", { exact: false }).first().click();
  const progressBar = page.locator('div[class*="bg-sky-400/70"]').first();
  await expect(progressBar).toBeVisible();
  const pp = await progressBar.evaluate((el) => getComputedStyle(el).transitionProperty);
  expect(pp).toBe("none");
});

test.describe("visual baselines (regenerate with --update-snapshots)", () => {
  test.use({ colorScheme: "dark" });

  // The global "Backend offline" banner appears asynchronously once the
  // health probes fail (~1.5-4.5s) and SHIFTS THE ENTIRE LAYOUT DOWN. Waiting
  // for it (the documented e2e phase runs with the API stopped) makes the
  // screenshots deterministic; racing it was the real flake root cause.
  const waitForSettledLayout = async (page: import("@playwright/test").Page): Promise<void> => {
    // .first() = the global banner (mission control also renders the text)
    await expect(page.getByText("Backend offline", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  };

  test("trail landing matches baseline", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.localStorage.clear());
    await waitForSettledLayout(page);
    await page.getByText("Vibe Coding Trail", { exact: false }).first().click();
    await expect(page.getByRole("heading", { name: "Vibe Coding Trail" })).toBeVisible();
    await expect(page).toHaveScreenshot("trail-landing.png", {
      fullPage: false,
      animations: "disabled",
      maxDiffPixelRatio: 0.02,
    });
  });

  test("topic 01 token bucket matches baseline", async ({ page }) => {
    // The bucket refills on a setInterval, so the fill bar drifts in real
    // time -> nondeterministic screenshots. Freeze the page clock AFTER the
    // layout settles (the health-check banner arrives asynchronously and
    // shifts the whole page — see waitForSettledLayout).
    await page.goto("/");
    await page.evaluate(() => window.localStorage.clear());
    await waitForSettledLayout(page);
    await page.clock.install();
    await page.goto("/#/trail/topic/01");
    await page.getByRole("button", { name: "Burst ×10" }).click();
    await expect(page.getByText("Accepted (200)", { exact: true })).toBeVisible();
    await expect(page).toHaveScreenshot("trail-topic01.png", {
      fullPage: false,
      animations: "disabled",
      maxDiffPixelRatio: 0.02,
    });
  });
});
