import { test, expect, Page } from "@playwright/test";
import fs from "node:fs";

/**
 * Architecture Studio end-to-end journeys. These drive the real UI in a
 * browser against `vite preview` (port 4173): no mocks, no shortcuts.
 */

const errorsOf = (page: Page): string[] => {
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    // the host dashboard polls an API that is not running in this test: ignore only that resource noise
    if (m.type() === "error" && !/Failed to load resource|net::ERR|ECONNREFUSED/.test(m.text())) errs.push(`console: ${m.text()}`);
  });
  return errs;
};

const fresh = async (page: Page, hash = "/#/studio") => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.goto(hash);
};

const add = async (page: Page, label: string) => page.getByRole("button", { name: `Add ${label}`, exact: true }).click();

const connectViaInspector = async (page: Page, fromNodeId: string, toName: string, type: string) => {
  await page.getByTestId(`node-${fromNodeId}`).click();
  const insp = page.getByTestId("inspector");
  await insp.getByLabel("Destination").selectOption({ label: toName });
  await insp.getByLabel("Connection type", { exact: true }).selectOption(type);
  await insp.getByRole("button", { name: "Add connection" }).click();
  await expect(insp.getByText("Connected.")).toBeVisible();
};

const setNum = async (page: Page, label: string, value: string) => {
  const f = page.getByTestId("inspector").getByLabel(label, { exact: true });
  await f.fill(value);
  await f.press("Enter");
};

test("full journey: scenario → design → validate → fail → improve → compare → ADR → save → reload → export", async ({ page }) => {
  const errs = errorsOf(page);
  await fresh(page);

  // 1–2. open Studio, five scenarios, select one
  await expect(page.getByTestId("studio-tabs")).toBeVisible();
  await expect(page.getByTestId("scenario-cards").locator("article")).toHaveCount(5);
  await expect(page.getByTestId("no-saved")).toBeVisible();
  await page.getByTestId("scenario-pdf-saas").getByRole("button", { name: "Start blank" }).click();
  await expect(page).toHaveURL(/#\/studio\/design/);

  // 3. review requirements
  await page.getByRole("link", { name: "Requirements", exact: true }).click();
  await expect(page.getByTestId("req-summary")).toContainText("0/10");
  await expect(page.getByTestId("req-detail")).toContainText("Protect the API from abusive traffic");
  await page.getByTestId("req-pdf-r3").click();
  await expect(page.getByTestId("req-detail")).toContainText("Generate large PDFs asynchronously");
  await expect(page.getByTestId("req-detail")).toContainText("Adds eventual consistency");
  await expect(page.getByTestId("req-detail").getByRole("link", { name: /Topic 15/ })).toBeVisible();

  // 4–5. build an architecture: add and connect components
  await page.getByRole("link", { name: "Design", exact: true }).click();
  const canvas = page.getByTestId("canvas");
  await expect(canvas).toHaveAttribute("aria-label", /0 components and 0 connections/);
  for (const k of ["Client", "API Gateway", "Application Service", "External Service", "PostgreSQL Database"]) await add(page, k);
  await expect(canvas).toHaveAttribute("aria-label", /5 components and 0 connections/);

  // connect mode (click-click)
  await page.getByRole("button", { name: "Connect mode" }).click();
  await page.getByTestId("node-n1").click();
  await page.getByTestId("node-n2").click();
  await expect(page.getByText("Connected.").first()).toBeVisible();
  await page.getByRole("button", { name: /Connect mode: ON/ }).click();
  // invalid connection is rejected with an explanation
  await page.getByTestId("node-n3").click();
  await page.getByTestId("inspector").getByLabel("Destination").selectOption({ label: "PostgreSQL Database" });
  await expect(page.getByTestId("inspector")).toContainText("Use a Data access connection");
  await connectViaInspector(page, "n2", "Application Service", "sync");
  await connectViaInspector(page, "n3", "External Service", "sync");
  await connectViaInspector(page, "n3", "PostgreSQL Database", "data");
  await expect(canvas).toHaveAttribute("aria-label", /5 components and 4 connections/);

  // 6. configure properties
  await page.getByTestId("node-n3").click();
  await setNum(page, "Instance count", "2");
  await setNum(page, "Outbound request timeout (ms, 0 = none)", "5000");
  await expect(page.getByTestId(`node-n3`)).toContainText("×2");

  // 7. validation with explanations
  await page.getByRole("link", { name: "Validate", exact: true }).click();
  const findings = page.getByTestId("findings");
  await expect(findings).toBeVisible();
  await expect(page.getByTestId("finding-critical-dependency-unhandled")).toBeVisible();
  await page.getByTestId("finding-critical-dependency-unhandled").getByRole("button", { name: /Explain/ }).click();
  await expect(page.getByTestId("finding-critical-dependency-unhandled")).toContainText("Ways to address it");
  await expect(page.getByTestId("finding-critical-dependency-unhandled")).toContainText("Trade-off:");
  await expect(page.getByTestId("finding-critical-dependency-unhandled")).toContainText("Context decides");

  // save this first version for comparison later
  await page.getByRole("link", { name: "Compare", exact: true }).click();
  await page.getByLabel("Save current canvas as…").fill("v1 first draft");
  await page.getByRole("button", { name: "Save version" }).click();
  await expect(page.getByText(/Saved “v1 first draft”/)).toBeVisible();

  // 8–9. failure injection on the unprotected design
  await page.getByRole("link", { name: "Failure Lab", exact: true }).click();
  await page.getByLabel("Failure", { exact: true }).selectOption("api-503");
  await page.getByRole("button", { name: "Inject failure" }).click();
  const result = page.getByTestId("failure-result");
  await expect(result).toContainText("User-visible failure");
  await expect(page.getByTestId("propagation")).toContainText(/contained|propagates/i);
  await expect(page.getByTestId("protections")).toContainText("Circuit breaker");
  await expect(page.getByTestId("protections")).toContainText("not active");
  await expect(page.getByTestId("trace")).toContainText("Failure injected");
  await expect(page.getByTestId("trace")).toContainText("Final outcome");
  // recovery does not resurrect failed synchronous requests
  await page.getByRole("button", { name: "Restore failed component" }).click();
  await page.getByRole("button", { name: /Recover queued work/ }).click();
  await expect(result).toContainText("not replayed");
  await page.getByRole("button", { name: "Remember current design as “before”" }).click();

  // 10. improve the architecture: circuit breaker with fallback guarding the external service
  await page.getByRole("link", { name: "Design", exact: true }).click();
  await add(page, "Circuit Breaker");
  const insp = page.getByTestId("inspector");
  await insp.getByLabel("Protects component").selectOption({ label: "External Service (External Service)" });
  await setNum(page, "Failures before opening", "3");
  await insp.getByLabel("Fallback while open").selectOption("degrade_feature");

  await page.getByRole("link", { name: "Failure Lab", exact: true }).click();
  await page.getByRole("button", { name: "Inject failure" }).click();
  await expect(page.getByTestId("failure-result")).toContainText("Degraded but served");
  await expect(page.getByTestId("failure-result")).not.toContainText("User-visible failure");
  await expect(page.getByTestId("before-after")).toContainText("changed");

  // 11. compare versions
  await page.getByRole("link", { name: "Compare", exact: true }).click();
  await page.getByLabel("Version A").selectOption({ label: "Saved: v1 first draft" });
  await page.getByLabel("Version B").selectOption({ label: "Current canvas" });
  await expect(page.getByTestId("compare-table")).toContainText("Operational overhead");
  await expect(page.getByTestId("tradeoffs")).toContainText("Circuit breaker");
  await expect(page.getByTestId("perspective")).toContainText("simpler architecture");
  await expect(page.getByText(/declare|better/i).first()).toBeVisible(); // explanatory copy only

  // 12. record an ADR
  await page.getByRole("link", { name: "Decisions", exact: true }).click();
  await page.getByRole("button", { name: "New decision" }).click();
  await page.getByLabel("Decision (short title)").fill("Guard the AI API with a circuit breaker");
  await page.getByLabel("Selected option — what are we choosing?").fill("Open the breaker after 3 failures and degrade the feature");
  await page.getByLabel("Reason — why this option?").fill("The AI API is down for minutes at a time and retries only add load");
  await page.getByLabel("Trade-offs").fill("Users lose AI features while the breaker is open");
  await page.getByRole("button", { name: "Save decision" }).click();
  await expect(page.getByTestId("adr-ADR-001")).toContainText("Guard the AI API");
  // incomplete ADRs are rejected
  await page.getByRole("button", { name: "New decision" }).click();
  await page.getByRole("button", { name: "Save decision" }).click();
  await expect(page.getByRole("alert")).toContainText("short title");
  await page.getByRole("button", { name: "Cancel" }).click();

  // 13. save → 14. reload
  await page.getByRole("link", { name: "Design", exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved to this browser.")).toBeVisible();
  await expect(page.getByTestId("save-status")).toContainText(/^Saved /);
  await page.reload();
  await expect(page.getByTestId("canvas")).toHaveAttribute("aria-label", /6 components and 4 connections/);
  await page.getByRole("link", { name: "Decisions", exact: true }).click();
  await expect(page.getByTestId("adr-ADR-001")).toBeVisible();
  await page.getByRole("link", { name: "Scenarios", exact: true }).click();
  await expect(page.getByTestId("saved-list")).toContainText("Viral PDF Generation SaaS");

  // 15. export the diagram
  await page.getByRole("link", { name: "Export", exact: true }).click();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download diagram (SVG)" }).click()]);
  expect(dl.suggestedFilename()).toMatch(/\.svg$/);
  const svg = fs.readFileSync((await dl.path()) as string, "utf8");
  expect(svg).toContain("<svg");
  expect(svg).toContain("Legend");
  expect(svg).toContain("Circuit Breaker");
  expect(svg).toContain("Synchronous request");
  const [spec] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download specification (Markdown)" }).click()]);
  const md = fs.readFileSync((await spec.path()) as string, "utf8");
  expect(md).toContain("## Components");
  expect(md).toContain("ADR-001");
  expect(md).toContain("Known risks");
  await expect(page.getByTestId("no-challenge-report")).toBeVisible(); // no fake report for unfinished work

  expect(errs).toEqual([]);
});

test("guided challenge: gates enforce real work and completion is earned", async ({ page }) => {
  const errs = errorsOf(page);
  await fresh(page);
  await page.getByTestId("scenario-notification-platform").getByRole("button", { name: "Guided challenge" }).click();
  await expect(page).toHaveURL(/#\/studio\/challenge/);
  const steps = page.getByTestId("challenge-steps");
  await expect(steps).toContainText("1. Read the scenario");

  // cannot skip: Next without reading
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Confirm you have read" })).toBeVisible();
  // scenario content is revealed progressively
  await expect(page.getByTestId("scenario-panel")).toContainText("Functional requirements are revealed in step 2");
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "I have read this" }).click();
    await page.getByRole("button", { name: "Next step" }).click();
  }
  // constraints: decoys exist; blank submission is refused
  await page.getByRole("button", { name: "Submit answers" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Select at least one" })).toBeVisible();
  await page.getByLabel("Provider APIs are slow and flaky; callers must not wait on them.").check();
  await page.getByLabel("Callers require the provider's response synchronously.").check(); // a decoy
  await page.getByRole("button", { name: "Submit answers" }).click();
  await expect(page.getByTestId("constraint-feedback")).toContainText("decoys");
  await page.getByRole("button", { name: "Next step" }).click();

  // sketch gate: blank canvas blocks
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "need ≥ 3" })).toBeVisible();
  // hints are progressive and capped at 3
  await page.getByRole("button", { name: "Show hint 1 of 3" }).click();
  await page.getByRole("button", { name: "Show hint 2 of 3" }).click();
  await page.getByRole("button", { name: "Show hint 3 of 3" }).click();
  await expect(page.getByRole("button", { name: "All hints shown" })).toBeDisabled();
  await expect(page.getByTestId("hints").locator("li")).toHaveCount(3);

  // sketch: client → API → queue → worker + external, then connect
  await page.getByRole("button", { name: "Open the canvas" }).click();
  await expect(page.getByTestId("canvas")).toHaveAttribute("aria-label", /0 components/);
  for (const k of ["Client", "Application Service", "Message Queue", "Background Worker", "External Service"]) await add(page, k);
  await connectViaInspector(page, "n1", "Application Service", "sync");
  await connectViaInspector(page, "n2", "Message Queue", "async");
  await connectViaInspector(page, "n3", "Background Worker", "async");
  await connectViaInspector(page, "n4", "External Service", "sync");
  await page.getByRole("link", { name: "Challenge", exact: true }).click();
  await page.getByRole("button", { name: "Next step" }).click(); // sketch accepted → step 6
  await expect(page.locator("[aria-current=step]")).toContainText("Explain your key decisions");

  // ADR needed (trivial reason rejected)
  await page.getByRole("link", { name: "Decisions", exact: true }).click();
  await page.getByRole("button", { name: "New decision" }).click();
  await page.getByLabel("Decision (short title)").fill("Queue notification sends");
  await page.getByLabel("Selected option — what are we choosing?").fill("Enqueue send requests and process them with a worker pool");
  await page.getByLabel("Reason — why this option?").fill("Provider calls are slow, so callers must not wait for them");
  await page.getByRole("button", { name: "Save decision" }).click();
  await page.getByRole("link", { name: "Challenge", exact: true }).click();
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.locator("[aria-current=step]")).toContainText("Run architecture validation");

  // validation must actually be run
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Run validation" })).toBeVisible();
  await page.getByRole("button", { name: "Run validation now" }).click();
  await expect(page.getByTestId("challenge-validation")).toContainText("critical");
  await page.getByRole("button", { name: "Next step" }).click();

  // inject a failure in the lab
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Run at least one failure" })).toBeVisible();
  await page.getByRole("button", { name: "Open the Failure Lab" }).click();
  await page.getByLabel("Failure", { exact: true }).selectOption("api-timeout");
  await page.getByRole("button", { name: "Inject failure" }).click();
  await expect(page.getByTestId("failure-result")).toBeVisible();
  await page.getByRole("link", { name: "Challenge", exact: true }).click();
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.locator("[aria-current=step]")).toContainText("Improve the architecture");

  // moving a box is not an improvement
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "unchanged" })).toBeVisible();
  await page.getByRole("button", { name: "Open the canvas" }).click();
  await page.getByTestId("node-n3").focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("link", { name: "Challenge", exact: true }).click();
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "unchanged" })).toBeVisible();
  // a real change is: set a timeout on the worker calling the external service
  await page.getByRole("button", { name: "Open the canvas" }).click();
  await page.getByTestId("node-n4").click();
  await setNum(page, "Outbound request timeout (ms, 0 = none)", "4000");
  await page.getByRole("link", { name: "Challenge", exact: true }).click();
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.locator("[aria-current=step]")).toContainText("Compare initial and final");

  // compare, then finalize
  await page.getByRole("button", { name: "Compare my first sketch with my current design" }).click();
  await expect(page.getByTestId("challenge-compare")).toBeVisible();
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.locator("[aria-current=step]")).toContainText("Generate the final review");
  await page.getByRole("button", { name: "Generate final review" }).click();
  const summary = page.getByTestId("challenge-summary");
  await expect(summary).toBeVisible();
  for (const h of ["Requirements addressed", "Requirements unresolved", "Failure scenarios survived", "Failure scenarios not handled", "Decisions recorded", "Topics practiced", "Areas for further study", "Simplicity"]) await expect(summary).toContainText(h);
  await expect(summary).toContainText("Adding components is never rewarded");

  // the challenge report is now available and honest
  await page.getByRole("link", { name: "Export", exact: true }).click();
  const [rep] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download challenge report" }).click()]);
  const md = fs.readFileSync((await rep.path()) as string, "utf8");
  expect(md).toContain("## Initial architecture");
  expect(md).toContain("## Final architecture");
  expect(md).toContain("Known limitations");
  expect(md).toContain("not proof");

  // reset requires confirmation
  await page.getByRole("link", { name: "Challenge", exact: true }).click();
  await page.getByRole("button", { name: "Reset challenge" }).click();
  await page.getByRole("button", { name: "Confirm reset?" }).click();
  await expect(page.locator("[aria-current=step]")).toContainText("Read the scenario");
  expect(errs).toEqual([]);
});

test("persistence management: rename, duplicate, delete with confirmation, export/import, invalid import rejected", async ({ page }) => {
  const errs = errorsOf(page);
  await fresh(page);
  await page.getByTestId("scenario-ecommerce-checkout").getByRole("button", { name: "Improve a first draft" }).click();
  await expect(page.getByTestId("canvas")).toHaveAttribute("aria-label", /5 components and 4 connections/);
  await page.getByRole("link", { name: "Scenarios", exact: true }).click();
  const list = page.getByTestId("saved-list");
  await list.getByRole("button", { name: "Rename" }).click();
  await page.getByLabel("New name").fill("My checkout v1");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(list).toContainText("My checkout v1");
  await list.getByRole("button", { name: "Duplicate" }).first().click();
  await expect(list.locator("li")).toHaveCount(2);
  await expect(list).toContainText("My checkout v1 (copy)");

  // export JSON then import it back
  const [dl] = await Promise.all([page.waitForEvent("download"), list.getByRole("button", { name: "Export JSON" }).first().click()]);
  const json = fs.readFileSync((await dl.path()) as string, "utf8");
  expect(JSON.parse(json).format).toBe("tracen-studio-workspace");
  await page.getByLabel("…or paste exported JSON").fill(json);
  await page.getByRole("button", { name: "Import pasted JSON" }).click();
  await expect(page).toHaveURL(/#\/studio\/design/);
  await expect(page.getByTestId("canvas")).toHaveAttribute("aria-label", /5 components and 4 connections/);

  // invalid imports are rejected and nothing is loaded
  await page.getByRole("link", { name: "Scenarios", exact: true }).click();
  const countBefore = 3; // original + duplicate + the successful import
  await expect(list.locator("li")).toHaveCount(countBefore);
  const bad = JSON.parse(json);
  bad.workspace.arch.connections[0].to = "ghost";
  await page.getByLabel("…or paste exported JSON").fill(JSON.stringify(bad));
  await page.getByRole("button", { name: "Import pasted JSON" }).click();
  await expect(page.getByRole("alert")).toContainText("Import rejected");
  await expect(page.getByRole("alert")).toContainText("does not exist");
  await page.getByLabel("…or paste exported JSON").fill("{ definitely not json");
  await page.getByRole("button", { name: "Import pasted JSON" }).click();
  await expect(page.getByRole("alert")).toContainText("Not valid JSON");
  await expect(list.locator("li")).toHaveCount(countBefore);

  // delete needs confirmation
  await list.getByRole("button", { name: "Delete" }).first().click();
  await expect(list.locator("li")).toHaveCount(countBefore);
  await list.getByRole("button", { name: "Confirm delete?" }).click();
  await expect(list.locator("li")).toHaveCount(countBefore - 1);
  expect(errs).toEqual([]);
});

test("canvas editing: keyboard move, disconnect, delete, undo, reset, groups", async ({ page }) => {
  const errs = errorsOf(page);
  await fresh(page);
  await page.getByTestId("scenario-realtime-collab").getByRole("button", { name: "Start blank" }).click();
  await add(page, "Application Service");
  await add(page, "PostgreSQL Database");
  const node = page.getByTestId("node-n1");
  const before = await node.getAttribute("transform");
  await node.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  expect(await node.getAttribute("transform")).not.toBe(before);
  // pointer drag moves the node and persists the new position
  const box = (await node.boundingBox()) as { x: number; y: number; width: number; height: number };
  const t0 = await node.getAttribute("transform");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 60, { steps: 8 });
  await page.mouse.up();
  const t1 = await node.getAttribute("transform");
  expect(t1).not.toBe(t0);
  await page.reload();
  expect(await page.getByTestId("node-n1").getAttribute("transform")).toBe(t1);
  // a plain click (no movement) selects instead of moving
  await page.getByTestId("node-n1").click();
  expect(await page.getByTestId("node-n1").getAttribute("transform")).toBe(t1);
  await expect(page.getByTestId("inspector")).toContainText("Application Service");
  // rename + group
  await node.click();
  await page.getByTestId("inspector").getByLabel("Name", { exact: true }).fill("Collab Gateway");
  await page.getByTestId("inspector").getByLabel("Group (optional)").fill("Real-time tier");
  await expect(page.getByTestId("canvas")).toContainText("Group: Real-time tier");
  await expect(page.getByTestId("node-n1")).toContainText("Collab Gateway");
  // connect, label, disconnect via the connection inspector
  await connectViaInspector(page, "n1", "PostgreSQL Database", "data");
  await page.getByTestId("inspector").getByRole("button", { name: /Disconnect to PostgreSQL/ }).click();
  await expect(page.getByTestId("canvas")).toHaveAttribute("aria-label", /2 components and 0 connections/);
  await connectViaInspector(page, "n1", "PostgreSQL Database", "data");
  await page.getByLabel(/Collab Gateway to PostgreSQL Database: Data access/).focus(); // keyboard path to a connection
  await page.keyboard.press("Enter");
  await page.getByTestId("inspector").getByLabel("Connection label").fill("persist edits");
  await expect(page.getByTestId("canvas")).toContainText("persist edits");
  // delete via keyboard, undo restores
  await page.getByTestId("node-n2").focus();
  await page.keyboard.press("Delete");
  await expect(page.getByTestId("canvas")).toHaveAttribute("aria-label", /1 components and 0 connections/);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("canvas")).toHaveAttribute("aria-label", /2 components and 1 connections/);
  // reset needs confirmation
  await page.getByRole("button", { name: "Reset canvas" }).click();
  await expect(page.getByTestId("canvas")).toHaveAttribute("aria-label", /2 components/);
  await page.getByRole("button", { name: "Confirm reset?" }).click();
  await expect(page.getByTestId("canvas")).toHaveAttribute("aria-label", /0 components and 0 connections/);
  // zoom controls work
  const zoomOf = async () => parseInt(((await page.getByTestId("zoom-level").textContent()) ?? "0").replace("%", ""), 10);
  const z0 = await zoomOf();
  await page.getByRole("button", { name: "Zoom in" }).click();
  expect(await zoomOf()).toBe(z0 + 15);
  await page.getByRole("button", { name: "Zoom out" }).click();
  expect(await zoomOf()).toBe(z0);
  await page.getByRole("button", { name: "100%", exact: true }).click();
  expect(await zoomOf()).toBe(100);
  expect(errs).toEqual([]);
});

test("capacity explorer is transparent and interactive", async ({ page }) => {
  await fresh(page);
  await page.getByTestId("scenario-pdf-saas").getByRole("button", { name: "Start blank" }).click();
  await page.getByRole("link", { name: "Capacity", exact: true }).click();
  await expect(page.getByText("Educational model — not a load test")).toBeVisible();
  const peak = page.getByTestId("load-peak");
  // the scenario's viral peak (200 req/s) exceeds two assumed instances (2 × 80 req/s): the model says so
  await expect(peak).toContainText("Overloaded");
  await page.getByLabel("Application instance count").fill("4");
  await page.getByLabel("Application instance count").press("Enter");
  await expect(peak).toContainText("Comfortable");
  await page.getByLabel("Peak requests per second (req/s)").fill("900");
  await page.getByLabel("Peak requests per second (req/s)").press("Enter");
  await expect(peak).toContainText("Overloaded");
  await expect(page.getByTestId("capacity-warnings")).toContainText("modelled capacity");
  await expect(page.getByTestId("bottlenecks")).toContainText("Application instances");
  // worker rate drives queue behavior
  await page.getByLabel("Worker instances").fill("0");
  await page.getByLabel("Worker instances").press("Enter");
  await expect(page.getByTestId("capacity-warnings")).toContainText("no workers");
  await expect(page.getByTestId("queue-stats")).toContainText("never");
  await expect(page.getByTestId("formulas").locator("li")).toHaveCount(8);
  await expect(page.getByText("The estimate is unreliable when…")).toBeVisible();
  // values survive a reload
  await page.reload();
  await expect(page.getByLabel("Peak requests per second (req/s)")).toHaveValue("900");
});

test("reduced motion disables animated request paths", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await fresh(page);
  await page.getByTestId("scenario-pdf-saas").getByRole("button", { name: "Improve a first draft" }).click();
  await page.getByRole("link", { name: "Failure Lab", exact: true }).click();
  await page.getByRole("button", { name: "Inject failure" }).click();
  await expect(page.getByTestId("failure-result")).toBeVisible();
  // with reduced motion the app does not even apply the animated class; and CSS also disables it
  await expect(page.locator(".studio-flow")).toHaveCount(0);
});

test("request paths animate when motion is allowed", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await fresh(page);
  await page.getByTestId("scenario-pdf-saas").getByRole("button", { name: "Improve a first draft" }).click();
  await page.getByRole("link", { name: "Failure Lab", exact: true }).click();
  await page.getByLabel("Failure", { exact: true }).selectOption("api-503");
  await page.getByRole("button", { name: "Inject failure" }).click();
  await expect(page.locator(".studio-flow").first()).toBeVisible();
  const anim = await page.locator(".studio-flow").first().evaluate((el) => getComputedStyle(el).animationName);
  expect(anim).toBe("studio-flow");
});

test("every Studio tab renders with accessible controls and no console errors", async ({ page }) => {
  const errs = errorsOf(page);
  await fresh(page);
  await page.getByTestId("scenario-payments-rewards").getByRole("button", { name: "Improve a first draft" }).click();
  for (const tab of ["scenarios", "design", "requirements", "validate", "capacity", "failures", "compare", "review", "decisions", "challenge", "export"]) {
    await page.goto(tab === "scenarios" ? "/#/studio" : `/#/studio/${tab}`);
    await expect(page.getByTestId("studio")).toBeVisible();
    await expect(page.getByTestId("studio-tabs").locator(`a[aria-current=page]`)).toHaveCount(1);
    const unnamed = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="studio"]') as HTMLElement;
      const bad: string[] = [];
      root.querySelectorAll("button, a[href], input, select, textarea").forEach((el) => {
        const e = el as HTMLInputElement;
        const label = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || (e.labels && e.labels.length ? e.labels[0].textContent : "") || el.textContent || el.getAttribute("title");
        if (!label || !label.trim()) bad.push(`${el.tagName.toLowerCase()}${e.type ? `[${e.type}]` : ""}`);
      });
      return bad;
    });
    expect(unnamed, `unnamed controls on ${tab}`).toEqual([]);
  }
  // review generates all ten categories
  await page.goto("/#/studio/review");
  await page.getByRole("button", { name: "Generate review" }).click();
  await expect(page.getByTestId("review-cards").locator("section")).toHaveCount(10);
  await expect(page.getByTestId("review-reliability")).toContainText("Next investigation");
  // a review goes stale when the design changes
  await page.goto("/#/studio/design");
  await add(page, "Redis Cache");
  await page.goto("/#/studio/review");
  await expect(page.getByText("The architecture changed since this review")).toBeVisible();
  expect(errs).toEqual([]);
});

test("tab pages without a workspace guide the learner instead of showing an empty editor", async ({ page }) => {
  await fresh(page, "/#/studio/design");
  await expect(page.getByTestId("no-workspace")).toContainText("Pick a scenario first");
  await page.getByRole("button", { name: "Choose a scenario" }).click();
  await expect(page.getByTestId("scenario-cards")).toBeVisible();
});

test("host app: sidebar entry and trail link reach the Studio", async ({ page }) => {
  await fresh(page, "/");
  await page.getByRole("button", { name: /Architecture Studio/ }).click();
  await expect(page).toHaveURL(/#\/studio/);
  await expect(page.getByTestId("studio")).toBeVisible();
  await page.getByRole("link", { name: "← Vibe Coding Trail" }).click();
  await expect(page.getByRole("heading", { name: "Vibe Coding Trail" })).toBeVisible();
  await page.getByRole("button", { name: "Architecture Studio →" }).click();
  await expect(page.getByTestId("studio")).toBeVisible();
  // topic links from the Studio open the existing trail topic
  await page.getByTestId("scenario-pdf-saas").getByRole("button", { name: "Start blank" }).click();
  await page.getByRole("link", { name: "Requirements", exact: true }).click();
  await page.getByTestId("req-detail").getByRole("link", { name: /Topic 01/ }).click();
  await expect(page).toHaveURL(/#\/trail\/topic\/01/);
});

test("mobile (375px): no page-level horizontal overflow on any tab; canvas scrolls inside its own container", async ({ page }) => {
  const errs = errorsOf(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await fresh(page);
  await page.getByTestId("scenario-pdf-saas").getByRole("button", { name: "Improve a first draft" }).click();
  for (const tab of ["scenarios", "design", "requirements", "validate", "capacity", "failures", "compare", "review", "decisions", "challenge", "export"]) {
    await page.goto(tab === "scenarios" ? "/#/studio" : `/#/studio/${tab}`);
    await expect(page.getByTestId("studio")).toBeVisible();
    const w = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, vw: window.innerWidth }));
    expect(w.doc, `horizontal overflow on ${tab}`).toBeLessThanOrEqual(w.vw);
  }
  await page.goto("/#/studio/design");
  const sc = page.getByTestId("canvas-scroll");
  const dims = await sc.evaluate((el) => ({ client: el.clientWidth, scroll: el.scrollWidth }));
  expect(dims.client).toBeLessThanOrEqual(375);
  expect(dims.scroll).toBeLessThanOrEqual(dims.client + 1); // auto-fit: the whole diagram width fits the phone
  // zooming in beyond the fit pans inside the canvas box — never the page
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: "Zoom in" }).click();
  const zoomed = await sc.evaluate((el) => ({ client: el.clientWidth, scroll: el.scrollWidth }));
  expect(zoomed.scroll).toBeGreaterThan(zoomed.client);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // the compact view switcher replaces the hidden sidebar
  await expect(page.getByRole("combobox", { name: "View" })).toBeVisible();
  await page.getByRole("button", { name: "Fit width" }).click();
  const fitted = await page.getByTestId("canvas").evaluate((el) => el.getBoundingClientRect().width);
  expect(fitted).toBeLessThanOrEqual(375);
  // library is usable on a phone: expand and add a component
  await page.getByRole("button", { name: /Component library/ }).click();
  await page.getByRole("button", { name: "Add Redis Cache", exact: true }).click();
  await expect(page.getByTestId("inspector")).toContainText("Redis Cache");
  expect(errs).toEqual([]);
});
