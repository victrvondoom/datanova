/**
 * Campaign 06 — visual review capture (§7): screenshots of every required
 * screen, saved to docs/campaign-06/evidence/screens/ for inspection.
 * Run against the preview build.
 */
import { test, expect } from "@playwright/test";
import * as fs from "node:fs";

const OUT = fs.existsSync("../../docs/campaign-06") ? "../../docs/campaign-06/evidence/screens" : "docs/campaign-06/evidence/screens";

const shoot = async (page: import("@playwright/test").Page, name: string): Promise<void> => {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
};

test.beforeAll(() => { fs.mkdirSync(OUT, { recursive: true }); });

test("visual review: capture every required screen", async ({ page }) => {
  page.setViewportSize({ width: 1440, height: 900 });

  await page.goto("/#/atlas/mission");
  await page.locator("nav[aria-label='Atlas sections']").waitFor();
  await page.waitForTimeout(600);
  await shoot(page, "01-mission-control");

  await page.goto("/#/atlas/studio");
  await page.waitForTimeout(2500); // let the 3D scene render a few frames
  await shoot(page, "02-studio-topology-3d");

  await page.locator("#mode-select").selectOption("dependency");
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /Metadata database/ }).first().click();
  await page.waitForTimeout(400);
  await shoot(page, "03-studio-dependency");

  await page.locator("#mode-select").selectOption("trust");
  await page.waitForTimeout(400);
  await shoot(page, "04-studio-trust");

  await page.locator("#mode-select").selectOption("lineage");
  await page.waitForTimeout(400);
  await shoot(page, "05-studio-data-lineage");

  await page.locator("#mode-select").selectOption("failure");
  await page.waitForTimeout(400);
  await shoot(page, "06-studio-failure");

  await page.getByRole("button", { name: "Run scenario" }).click();
  await page.waitForTimeout(700);
  await shoot(page, "07-studio-traffic-with-scenario");

  await page.locator("#mode-select").selectOption("recovery");
  await page.waitForTimeout(400);
  await shoot(page, "08-studio-recovery");

  await page.locator("#mode-select").selectOption("evidence");
  await page.waitForTimeout(400);
  await shoot(page, "09-studio-evidence");

  await page.getByRole("button", { name: "3D" }).click();
  await page.waitForTimeout(500);
  await shoot(page, "10-studio-2d-fallback");

  await page.goto("/#/atlas/experiments");
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Run scenario" }).click();
  await page.waitForTimeout(600);
  await shoot(page, "11-experiments");

  await page.goto("/#/atlas/validation");
  await page.waitForTimeout(600);
  await shoot(page, "12-validation-room");

  await page.goto("/#/atlas/exchange");
  await page.waitForTimeout(600);
  await shoot(page, "13-evidence-exchange");

  await page.goto("/#/atlas/benchmarks");
  await page.waitForTimeout(600);
  await shoot(page, "14-benchmarks");

  await page.goto("/#/atlas/sources");
  await page.waitForTimeout(600);
  await shoot(page, "15-sources");

  await page.goto("/#/atlas/decisions");
  await page.waitForTimeout(600);
  await shoot(page, "16-decisions");

  await page.goto("/#/atlas/system");
  await page.waitForTimeout(600);
  await shoot(page, "17-design-system");

  await page.setViewportSize({ width: 1024, height: 700 });
  await page.goto("/#/atlas/studio");
  await page.waitForTimeout(2000);
  await shoot(page, "18-responsive-studio");

  // sanity: the 3D canvas actually produced content (not a blank screen)
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/atlas/studio");
  await page.waitForTimeout(2500);
  await shoot(page, "19-studio-final");
  expect(fs.existsSync(`${OUT}/02-studio-topology-3d.png`)).toBe(true);
});
