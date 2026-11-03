/**
 * Local demo driver: opens the Workflow Studio, runs the GPU billing audit
 * end-to-end (including the human approval), captures screenshots and prints
 * the real persisted audit-trail event log.
 */
import { chromium } from "@playwright/test";
import * as fs from "node:fs";

const OUT = "docs/workflow-studio/demo";
const URL = "http://localhost:5173/#/atlas/agents";

const main = async (): Promise<void> => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto(URL);
  await page.getByTestId("agent-studio").waitFor();

  console.log("=== WORKFLOW STUDIO — local run: GPU & Cloud Billing Audit ===\n");
  console.log("Workflow selected:", await page.locator("#wf-select option:checked").textContent());
  console.log("Dataset:", await page.getByText(/dataset:/).first().textContent());

  await page.getByRole("button", { name: /Run Workflow/ }).click();
  console.log("\n[Run Workflow pressed]");

  await page.waitForTimeout(3200);
  await page.screenshot({ path: `${OUT}/01-canvas-running.png` });
  const statusLine = await page.locator("header span.text-\\[10px\\]").first().textContent();
  console.log("Canvas mid-run status:", statusLine);

  // human checkpoint
  const dialog = page.getByRole("dialog", { name: "Human approval required" });
  await dialog.waitFor({ timeout: 30_000 });
  console.log("\n--- EXECUTION PAUSED: human approval required ---");
  console.log(await dialog.locator("p.text-xs").textContent());
  await page.screenshot({ path: `${OUT}/02-human-checkpoint.png` });

  await dialog.getByRole("button", { name: /Approve/ }).click();
  console.log("\n[Human decision: APPROVE — resuming from checkpoint]");

  await page.locator("header").getByText("completed").waitFor({ timeout: 30_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/03-canvas-completed.png` });
  console.log("Run status:", await page.locator("header [title*='Run run-']").textContent());
  console.log("Final status line:", await page.locator("header span.text-\\[10px\\]").first().textContent());

  // board
  await page.locator("nav[aria-label='Studio views'] button", { hasText: "Board" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/04-board.png` });
  const columns = await page.locator("section[aria-label$='column']").all();
  for (const col of columns) {
    const name = await col.locator("h3").textContent();
    const cards = await col.locator("button").count();
    if (cards > 0) console.log(`Board ${name}`);
  }

  // audit trail — print the real persisted event log
  await page.locator("nav[aria-label='Studio views'] button", { hasText: "Audit" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/05-audit-trail.png` });
  console.log("\n--- AUDIT TRAIL (persisted events, verbatim) ---");
  const events = await page.locator("ol[aria-label='Immutable chronological event log'] li").all();
  for (const ev of events) {
    const text = (await ev.textContent())?.replace(/\s+/g, " ").trim();
    console.log(text);
  }

  // inspector: Cost Allocator's computed output
  await page.locator("nav[aria-label='Studio views'] button", { hasText: "Canvas" }).click();
  await page.locator("g[aria-label*='Cost Allocator']").first().click({ force: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/06-inspector.png` });

  // infrastructure map
  await page.locator("nav[aria-label='Studio views'] button", { hasText: "Infrastructure" }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/07-infrastructure.png` });
  const apiState = await page.getByText(/HEALTHY|OFFLINE/).first().textContent();
  console.log("\n--- INFRASTRUCTURE (real probes) ---");
  console.log("FastAPI backend (/api/health):", apiState);
  console.log("Live LLM inference:", await page.getByText("No inference endpoint configured", { exact: false }).first().textContent().catch(() => "n/a"));

  await browser.close();
  console.log(`\nScreenshots saved to ${OUT}/`);
};

main().catch((e) => { console.error(e); process.exit(1); });
