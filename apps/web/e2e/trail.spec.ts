import { test, expect } from "@playwright/test";

/**
 * TRACEN Vibe Coding Trail — user-flow E2E against the production build
 * (vite preview on 4173). Verifies the required learning journey:
 * open the trail -> start topic 01 -> interact with the simulation ->
 * answer the knowledge check -> completion is recorded -> navigate to
 * topic 02 -> glossary -> case study -> progress persists across reload ->
 * reset works.
 */

const TRAIL_TAB = "Vibe Coding Trail";

test.beforeEach(async ({ page }) => {
  // deterministic start: no persisted progress
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
});

test("trail home shows branding, mission, and progress", async ({ page }) => {
  await page.getByText(TRAIL_TAB, { exact: false }).first().click();
  await expect(page.getByRole("heading", { name: "Vibe Coding Trail" })).toBeVisible();
  await expect(page.getByText(/0\/20 topics/).first()).toBeVisible();
  await expect(page.getByText("Topic navigator")).toBeVisible();
});

test("full learning flow: simulate + quiz completes topic 01, progress persists, reset works", async ({
  page,
}) => {
  // 1. Open the trail
  await page.getByText(TRAIL_TAB, { exact: false }).first().click();

  // 2. Start Topic 01 — Rate Limiting
  await page.getByRole("button", { name: /Start Topic 01/ }).click();
  await expect(page.getByRole("heading", { name: "Rate Limiting" })).toBeVisible();
  await expect(page.getByText("The Problem")).toBeVisible();

  // 3. Interact with the simulation (send a burst of requests)
  await page.getByRole("button", { name: "Burst ×10" }).click();
  await expect(page.getByText("Accepted (200)", { exact: true })).toBeVisible();
  await expect(page.getByText(/Burst of 10: 10 accepted/)).toBeVisible();

  // 4. The knowledge check: complete requires quiz + sim
  const quiz = page.getByRole("button", { name: "429 Too Many Requests", exact: true });
  await expect(quiz).toBeVisible();

  // 5. Before answering: not completed yet
  await expect(page.getByText("Topic completed ✓")).toHaveCount(0);

  // Answer correctly (429 is at index 1 in the options list for topic 01)
  await quiz.click();
  await expect(page.getByText("✓ Correct.", { exact: false }).first()).toBeVisible();

  // Completion recorded once both conditions hold
  await expect(page.getByText(/Topic completed ✓|Completed/).first()).toBeVisible({ timeout: 5_000 });

  // 6. Navigate to Topic 02 via next
  await page.getByRole("button", { name: /02 Caching →/ }).click();
  await expect(page.getByRole("heading", { name: "Caching" })).toBeVisible();

  // 7. Open the glossary and search
  await page.getByRole("button", { name: "Glossary" }).click();
  await page.getByLabel("Search glossary").fill("jitter");
  await expect(page.getByText("Jitter")).toBeVisible();
  await page.getByLabel("Search glossary").fill("");
  await expect(page.getByText("22 of 22 entries")).toBeVisible();

  // 8. Open the case study and step it
  await page.getByRole("button", { name: "Case study" }).click();
  await page.getByRole("button", { name: "▶ Start scenario" }).click();
  await page.getByRole("button", { name: "Advance one step" }).click();
  await expect(page.getByText(/Step 2 of 6/)).toBeVisible();

  // 9. Reload — progress must persist (the hash restores the case-study
  // sub-route; return to the trail home to see progress reflected)
  await page.reload();
  await page.getByText(TRAIL_TAB, { exact: false }).first().click();
  await expect(page.getByText(/1\/20 complete/).first()).toBeVisible();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Vibe Coding Trail" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue: Topic 02" })).toBeVisible();

  // 9b. Simulation-interaction evidence ALSO survived the reload (persisted,
  // not session state): topic 01 shows the interaction as already recorded.
  await page.goto("#/trail/topic/01");
  await expect(page.getByText("interaction recorded ✓")).toBeVisible();

  // 10. Reset progress with confirmation (two clicks)
  await page.getByRole("button", { name: "Reset progress" }).click();
  await expect(page.getByRole("button", { name: "Confirm reset?" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm reset?" }).click();
  await expect(page.getByText(/0\/20 complete/).first()).toBeVisible();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Vibe Coding Trail" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Continue: Topic/ })).toHaveCount(0);
  // and the persisted sim-interaction evidence is gone too
  await page.goto("#/trail/topic/01");
  await expect(page.getByText("interaction recorded ✓")).toHaveCount(0);
});

test("final quiz: all five handbook questions answerable and scoreable", async ({ page }) => {
  await page.getByText(TRAIL_TAB, { exact: false }).first().click();
  await page.getByRole("button", { name: "Quiz" }).click();
  await expect(page.getByText(/CORS protect the API/)).toBeVisible();

  // Finish disabled until all answered
  await expect(page.getByRole("button", { name: "Finish and score" })).toBeDisabled();

  // Q1: "No — use an API Gateway / Auth"
  await page.getByRole("button", { name: "No — use an API Gateway / Auth" }).click();
  // Q2: accidental DDoS
  await page.getByRole("button", { name: /accidentally DDoS the recovering server/ }).click();
  // Q3: No — queues are for async work
  await page.getByRole("button", { name: /No — queues are for async work/ }).click();
  // Q4: Compensating Transaction in a Saga
  await page.getByRole("button", { name: /A Compensating Transaction in a Saga/ }).click();
  // Q5: Container
  await page.getByRole("button", { name: "Container", exact: true }).click();

  await page.getByRole("button", { name: "Finish and score" }).click();
  await expect(page.getByText(/final score: 5\/5/)).toBeVisible();
  await expect(page.getByText("Completion summary")).toBeVisible();
});

test("no console errors and no dead navigation on a sample topic", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  await page.getByText(TRAIL_TAB, { exact: false }).first().click();
  await page.getByRole("button", { name: "Open the architecture journey" }).click();
  await expect(page.getByRole("heading", { name: "The Architecture Journey" })).toBeVisible();
  // every stage tab renders its topics
  for (const stage of ["1. Entry", "2. Routing", "3. Execution", "4. Reliability", "5. Async Flow"]) {
    await page.getByRole("button", { name: stage, exact: true }).click();
  }
  // jump straight to topic 20 by URL
  await page.goto("#/trail/topic/20");
  await expect(page.getByRole("heading", { name: "Cron Jobs (Scheduled Tasks)" })).toBeVisible();
  expect(errors).toEqual([]);
});
