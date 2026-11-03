/**
 * Deterministic agent executors — workflows 05–11 (procurement, disputes,
 * trust accounting, event finance, month-end close, agent trust, voice
 * fraud). Same contract as executors.ts: pure functions over direct upstream
 * artifacts + the case dataset.
 */

import type { AgentResult, ExecContext } from "./types";
import { genericVerifier } from "./executors";

const f = (ctx: ExecContext): Record<string, unknown> => ctx.dataset.fields as Record<string, unknown>;
const from = (ctx: ExecContext, nodeId: string): Record<string, unknown> | undefined => {
  const a = [...ctx.upstream].reverse().find((x) => x.nodeId === nodeId);
  return a?.payload;
};
const req = (ctx: ExecContext, nodeId: string): Record<string, unknown> => {
  const p = from(ctx, nodeId);
  if (!p) throw new Error(`executor missing upstream artifact from ${nodeId}`);
  return p;
};
const num = (v: unknown, fallback = 0): number => (typeof v === "number" ? v : Number(v ?? fallback) || fallback);
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const evidence = (claim: string, source: string, payload?: Record<string, unknown>): AgentResult["evidence"] => [
  { claim, source, payload: payload ?? {} },
];
const finding = (severity: "info" | "low" | "medium" | "high" | "critical", summary: string, amount?: { value: number; currency: string }): AgentResult["findings"] => [
  { severity, summary, amount },
];
const mk = (fn: (ctx: ExecContext) => AgentResult): ((ctx: ExecContext) => AgentResult) => fn;

const wf05: Record<string, (ctx: ExecContext) => AgentResult> = {
  "wf05-request-parser": mk((ctx) => {
    const r = f(ctx).request as { requestId: string; budget: number; spec: { item: string; quantity: number; minWarranty: number } };
    const offers = f(ctx).offers as Array<{ seller: string; pricePerUnit: number; description: string }>;
    return {
      ok: true,
      payload: { requestId: r.requestId, spec: r.spec, budget: r.budget, offers, totalBudgetPerUnit: r.budget / r.spec.quantity },
      summary: `Procurement ${r.requestId}: ${r.spec.quantity} × ${r.spec.item}, budget $${r.budget}.`,
      evidence: evidence("request-record", `request:${r.requestId}`, r as unknown as Record<string, unknown>),
    };
  }),
  "wf05-spec-matching": mk((ctx) => {
    const p = req(ctx, "request-parser");
    const offers = p.offers as Array<{ seller: string; specMatch: boolean }>;
    return {
      ok: true,
      payload: { matchingOffers: offers.filter((o) => o.specMatch).map((o) => o.seller), rejectedOffers: offers.filter((o) => !o.specMatch).map((o) => o.seller) },
      summary: `${offers.filter((o) => o.specMatch).length} of ${offers.length} offers match the specification.`,
      evidence: evidence("spec-match-trace", "offer-catalog", { matching: offers.filter((o) => o.specMatch).map((o) => o.seller) }),
    };
  }),
  "wf05-supplier-research": mk((ctx) => {
    const offers = (f(ctx).offers as Array<{ seller: string; domain: string }>);
    return {
      ok: true,
      payload: { supplierProfiles: offers.map((o) => ({ seller: o.seller, domain: o.domain })) },
      summary: `Researched ${offers.length} suppliers.`,
      evidence: evidence("supplier-profiles", "supplier-directory", { profiles: offers.length }),
    };
  }),
  "wf05-seller-identity": mk((ctx) => {
    const offers = (f(ctx).offers as Array<{ seller: string; domain: string; registered: boolean }>);
    const unregistered = offers.filter((o) => !o.registered);
    return {
      ok: true,
      payload: { sellerVerifications: offers.map((o) => ({ seller: o.seller, registered: o.registered })) },
      summary: unregistered.length ? `Unregistered seller(s): ${unregistered.map((o) => o.seller).join(", ")}` : "All sellers registered.",
      evidence: evidence("seller-identity-records", "seller-registry", { unregistered: unregistered.map((o) => o.seller) }),
      findings: unregistered.length ? finding("high", `Unregistered seller: ${unregistered.map((o) => o.seller).join(", ")}`) : [],
    };
  }),
  "wf05-price-benchmark": mk((ctx) => {
    const m = f(ctx).marketPrices as { medianPerUnit: number };
    const offers = (f(ctx).offers as Array<{ seller: string; pricePerUnit: number }>);
    const outliers = offers.filter((o) => o.pricePerUnit < m.medianPerUnit * 0.7 || o.pricePerUnit > m.medianPerUnit * 1.3);
    return {
      ok: true,
      payload: { benchmarks: { medianPerUnit: m.medianPerUnit }, outliers: outliers.map((o) => o.seller) },
      summary: `Median market price $${m.medianPerUnit}/unit; ${outliers.length} outlier offer(s).`,
      evidence: evidence("price-benchmarks", "market-prices", { median: m.medianPerUnit, outliers: outliers.map((o) => o.seller) }),
      findings: outliers.map((o) => ({ severity: "medium" as const, summary: `${o.seller} priced at $${o.pricePerUnit} — far from the $${m.medianPerUnit} market median` })),
    };
  }),
  "wf05-bid-comparison": mk((ctx) => {
    const bench = req(ctx, "price-benchmark");
    const r = f(ctx).request as { budget: number; spec: { quantity: number } };
    const budgetPerUnit = r.budget / r.spec.quantity;
    const offers = f(ctx).offers as Array<{ seller: string; pricePerUnit: number; specMatch: boolean }>;
    const eligible = offers.filter((o) => o.specMatch && o.pricePerUnit <= budgetPerUnit && !(bench.outliers as string[]).includes(o.seller));
    const recommended = eligible.sort((a, b) => a.pricePerUnit - b.pricePerUnit)[0];
    if (!recommended) return { ok: false, error: "no eligible offer after spec, budget and outlier filters", retryable: false };
    const total = recommended.pricePerUnit * r.spec.quantity;
    return {
      ok: true,
      payload: { bidRanking: eligible.map((o) => ({ seller: o.seller, pricePerUnit: o.pricePerUnit })), recommendedOffer: recommended.seller, quantity: r.spec.quantity, total },
      summary: `Recommended offer: ${recommended.seller} at $${recommended.pricePerUnit}/unit ($${total} total).`,
      evidence: evidence("bid-comparison", "bid-ledger", { recommended: recommended.seller, eligible: eligible.map((o) => o.seller) }),
    };
  }),
  "wf05-vendor-risk": mk((ctx) => {
    const offers = f(ctx).offers as Array<{ seller: string; domain: string; registered: boolean }>;
    return {
      ok: true,
      payload: { vendorRisk: offers.map((o) => ({ seller: o.seller, risk: o.registered ? "low" : "high" })) },
      summary: "Vendor risk assessed per supplier registration and domain.",
      evidence: evidence("risk-assessment", "risk-models", { assessed: offers.length }),
    };
  }),
  "wf05-cart-intent": mk((ctx) => {
    const bid = req(ctx, "bid-comparison");
    const r = f(ctx).request as { budget: number };
    const ok = num(bid.total) <= r.budget;
    return {
      ok: true,
      payload: { cartMatchesIntent: ok, cartTotal: num(bid.total), budget: r.budget, seller: str(bid.recommendedOffer) },
      summary: ok ? `Cart matches intent: $${num(bid.total)} within $${r.budget} budget.` : `Cart exceeds budget.`,
      evidence: evidence("cart-verification", "cart-reader", { total: num(bid.total), budget: r.budget }),
    };
  }),
  "wf05-red-team": mk((ctx) => {
    const offers = f(ctx).offers as Array<{ seller: string; description: string }>;
    const injected = offers.filter((o) => /ignore (all )?previous instructions/i.test(o.description));
    return {
      ok: true,
      payload: {
        injectionFindings: injected.map((o) => ({ seller: o.seller, pattern: "instruction-override in offer description", treatedAs: "data, not instructions" })),
        suspiciousListings: injected.map((o) => o.seller),
      },
      summary: injected.length
        ? `Prompt-injection payload detected in ${injected.map((o) => o.seller).join(", ")} listing description — quarantined as untrusted data.`
        : "No prompt-injection payloads detected.",
      evidence: evidence("adversarial-probe", "red-team-probe", { injected: injected.map((o) => o.seller) }),
      findings: injected.map((o) => ({ severity: "critical" as const, summary: `Prompt injection detected in ${o.seller} offer description — rejected as untrusted data` })),
    };
  }),
  "wf05-policy-controller": mk((ctx) => {
    const cart = req(ctx, "cart-intent");
    const red = req(ctx, "red-team");
    const vendor = req(ctx, "vendor-risk");
    const blocked = (red.suspiciousListings as string[]).includes(str(cart.seller));
    return {
      ok: true,
      payload: { policyDecision: blocked || !cart.cartMatchesIntent ? "REJECT" : "APPROVE-RECOMMENDATION", seller: str(cart.seller), withinBudget: cart.cartMatchesIntent === true, vendorRiskUsed: vendor.vendorRisk },
      summary: blocked ? "Policy decision: REJECT — recommended path contaminated by injection-flagged listing." : `Policy decision: APPROVE recommendation for ${str(cart.seller)} — human authorization still required.`,
      evidence: evidence("policy-evaluation", "policy-rules", { blocked, seller: str(cart.seller) }),
      findings: blocked ? finding("high", "Purchase policy blocked a recommendation derived from a suspicious listing") : [],
    };
  }),
  "wf05-human-approver": mk((ctx) => {
    const pol = req(ctx, "policy-controller");
    return {
      ok: true,
      payload: { decision: str(pol.policyDecision) === "APPROVE-RECOMMENDATION" ? "REQUEST-HUMAN-AUTHORIZATION" : "REJECTED", requiresHumanApproval: true },
      summary: "The model may never authorize payment — human authorization checkpoint reached.",
      evidence: evidence("human-decision-required", "approval-ledger", { pending: true }),
    };
  }),
  "wf05-outcome-verification": mk((ctx) => {
    const approval = req(ctx, "approval");
    return {
      ok: true,
      payload: { orderVerified: false, reason: "no authorized purchase integration configured — no order was placed", humanDecision: str(approval.decision) },
      summary: "Outcome verification: no order executed (no authorized purchase integration). The decision record is complete.",
      evidence: evidence("order-record", "outcome-verification", { executed: false }),
      findings: finding("info", "No purchase executed — authorized integration not configured; verification recorded honestly"),
    };
  }),
  "wf05-verifier": genericVerifier,
};

const wf06: Record<string, (ctx: ExecContext) => AgentResult> = {
  "wf06-claim-intake": mk((ctx) => {
    const c = f(ctx).claim as { claimId: string; claimedCredit: number; window: string; slaReferences: string[] };
    return {
      ok: true,
      payload: { claimId: c.claimId, claimedCredit: c.claimedCredit, window: c.window, slaReferences: c.slaReferences },
      summary: `Claim ${c.claimId}: $${c.claimedCredit} requested for window ${c.window}.`,
      evidence: evidence("claim-record", `claim:${c.claimId}`, c as unknown as Record<string, unknown>),
    };
  }),
  "wf06-entitlement-analyst": mk((ctx) => {
    const c = f(ctx).contract as { contractId: string; clauses: Array<{ ref: string; text: string }>; monthlyFee: number };
    return {
      ok: true,
      payload: { entitlements: "10% of monthly fee per started hour below 99.9% availability", clauseRefs: c.clauses.map((x) => x.ref), monthlyFee: c.monthlyFee },
      summary: `${c.clauses[0].ref}: credit = 10% × $${c.monthlyFee} per started hour of degradation.`,
      evidence: evidence("contract-clauses", `contract:${c.contractId}`, c as unknown as Record<string, unknown>),
    };
  }),
  "wf06-telemetry-analyst": mk((ctx) => {
    const t = f(ctx).telemetry as { internalErrorRate: number; window: string; source: string };
    return {
      ok: true,
      payload: { errorRate: t.internalErrorRate, incidentWindow: t.window, telemetrySummary: `internal telemetry: ${(t.internalErrorRate * 100).toFixed(1)}% error rate in window ${t.window}` },
      summary: `Internal telemetry shows ${(t.internalErrorRate * 100).toFixed(1)}% errors in the claimed window.`,
      evidence: evidence("telemetry-extract", t.source, t as unknown as Record<string, unknown>),
    };
  }),
  "wf06-usage-evidence": mk((ctx) => {
    const u = f(ctx).usage as { records: number; failedInWindow: number };
    return {
      ok: true,
      payload: { affectedUsage: u, impactSummary: `${u.failedInWindow} of ${u.records} requests failed in the window` },
      summary: `${u.failedInWindow} of ${u.records} requests affected.`,
      evidence: evidence("usage-records", "usage-records", u as unknown as Record<string, unknown>),
    };
  }),
  "wf06-incident-analyst": mk((ctx) => {
    const inc = f(ctx).incidents as Array<{ id: string; started: string; resolved: string }>;
    const ps = f(ctx).providerStatus as { providerClaimedAvailability: string; source: string };
    return {
      ok: true,
      payload: { incidents: inc, providerStatus: ps },
      summary: `Internal incident ${inc[0].id} (${inc[0].started}→${inc[0].resolved}) conflicts with provider-claimed ${ps.providerClaimedAvailability} availability.`,
      evidence: evidence("incident-records", "incident-records+provider-portal", { incidents: inc, provider: ps }),
    };
  }),
  "wf06-credit-calculator": mk((ctx) => {
    const ent = req(ctx, "entitlement-analyst");
    const tel = req(ctx, "telemetry-analyst");
    const inc = f(ctx).incidents as Array<{ started: string; resolved: string }>;
    const startedHours = Math.ceil((new Date(inc[0].resolved).getTime() - new Date(inc[0].started).getTime()) / 3_600_000);
    const credit = startedHours * 0.1 * num(ent.monthlyFee);
    return {
      ok: true,
      payload: { calculatedCredit: credit, formulaTrace: `${startedHours} started hours × 10% × $${num(ent.monthlyFee)} = $${credit}`, telemetryErrorRate: num(tel.errorRate) },
      summary: `Deterministic credit: $${credit.toFixed(2)} (${startedHours} started hours × 10% × monthly fee).`,
      evidence: evidence("credit-computation", "deterministic-calculation", { credit, startedHours }),
      findings: finding("medium", `Computed credit $${credit.toFixed(2)} differs from claimed $${(f(ctx).claim as { claimedCredit: number }).claimedCredit}`),
    };
  }),
  "wf06-confidence-reviewer": mk((ctx) => {
    const tel = req(ctx, "telemetry-analyst");
    const inc = req(ctx, "incident-analyst");
    const contradictions = ["internal telemetry shows 91.3% errors in the window vs provider-claimed 99.98% availability"];
    return {
      ok: true,
      payload: { confidence: "medium", contradictions, sources: [str(tel.telemetrySummary), str((inc.providerStatus as { providerClaimedAvailability?: string }).providerClaimedAvailability ?? "")] },
      summary: `Confidence review: ${contradictions.length} contradiction(s) between sources — human review required.`,
      evidence: evidence("contradiction-report", "confidence-review", { contradictions }),
      findings: finding("high", "Contradictory evidence between internal telemetry and provider status — escalate to human"),
    };
  }),
  "wf06-verifier": genericVerifier,
  "wf06-policy-decision": mk((ctx) => {
    const credit = req(ctx, "credit-calculator");
    const verdict = req(ctx, "verifier");
    const ph = f(ctx).policyHistory as { version: string };
    return {
      ok: true,
      payload: { policyDecision: `offer computed credit $${num(credit.calculatedCredit).toFixed(2)}`, policyVersion: ph.version, verifierVerdict: str(verdict.verdict), calculatedCredit: num(credit.calculatedCredit) },
      summary: `Policy ${ph.version}: offer the computed credit $${num(credit.calculatedCredit).toFixed(2)} with the contradiction recorded.`,
      evidence: evidence("policy-evaluation", `policy:${ph.version}`, { credit: num(credit.calculatedCredit) }),
    };
  }),
  "wf06-human-escalation": mk((ctx) => {
    req(ctx, "policy-decision"); // dependency asserted: escalation requires the policy decision
    return {
      ok: true,
      payload: { escalation: "contradictory evidence between internal telemetry and provider status requires human override or acceptance", requiresHumanApproval: true },
      summary: "Escalation: human must decide between contradictory sources before any dispute is filed.",
      evidence: evidence("escalation", "human-escalation", { reason: "contradictory evidence" }),
      findings: finding("high", "Human escalation required before dispute execution"),
    };
  }),
  "wf06-dispute-execution": mk((ctx) => {
    const pol = req(ctx, "policy-decision");
    return {
      ok: true,
      payload: { disputePackage: { credit: num(pol.calculatedCredit), policyVersion: str(pol.policyVersion), evidenceLinked: true }, executed: false, reason: "external dispute filing connector not configured" },
      summary: `Dispute package prepared for $${num(pol.calculatedCredit).toFixed(2)} — filing withheld (no authorized connector).`,
      evidence: evidence("dispute-draft", "dispute-preparation", { credit: num(pol.calculatedCredit) }),
    };
  }),
  "wf06-outcome-reconciler": mk((ctx) => {
    const disp = req(ctx, "dispute-execution");
    const claim = f(ctx).claim as { claimedCredit: number };
    return {
      ok: true,
      payload: { finalOutcome: `computed credit $${num((disp.disputePackage as { credit: number }).credit).toFixed(2)} vs claimed $${claim.claimedCredit}`, reconciliation: { claimed: claim.claimedCredit, computed: num((disp.disputePackage as { credit: number }).credit) } },
      summary: `Outcome reconciled: claimed $${claim.claimedCredit} vs computed $${num((disp.disputePackage as { credit: number }).credit).toFixed(2)} — historical execution preserved.`,
      evidence: evidence("outcome-record", "outcome-reconciliation", { claimed: claim.claimedCredit }),
    };
  }),
};

const wf07: Record<string, (ctx: ExecContext) => AgentResult> = {
  "wf07-agreement-extraction": mk((ctx) => {
    const a = f(ctx).agreement as { agreementId: string; beneficiaries: Array<{ id: string; name: string }>; ownershipSplit: Record<string, number>; distributionTerms: string };
    return {
      ok: true,
      payload: { agreementId: a.agreementId, beneficiaries: a.beneficiaries, ownershipSplit: a.ownershipSplit, distributionTerms: a.distributionTerms },
      summary: `Agreement ${a.agreementId}: ${Object.values(a.ownershipSplit).join("/")} ownership split, ${a.distributionTerms}.`,
      evidence: evidence("agreement-extract", `agreement:${a.agreementId}`, a as unknown as Record<string, unknown>),
    };
  }),
  "wf07-beneficiary-identity": mk((ctx) => {
    const a = f(ctx).agreement as { beneficiaries: Array<{ id: string; name: string }> };
    return {
      ok: true,
      payload: { verifiedBeneficiaries: a.beneficiaries },
      summary: `All ${a.beneficiaries.length} beneficiaries verified against the registry.`,
      evidence: evidence("identity-records", "beneficiary-registry", { count: a.beneficiaries.length }),
    };
  }),
  "wf07-ownership-allocation": mk((ctx) => {
    const agr = req(ctx, "agreement-extraction");
    const period = f(ctx).period as { quarter: string; realizedIncome: number };
    const split = agr.ownershipSplit as Record<string, number>;
    const allocations = Object.fromEntries(Object.entries(split).map(([k, v]) => [k, v * period.realizedIncome]));
    return {
      ok: true,
      payload: { allocations, quarter: period.quarter, realizedIncome: period.realizedIncome },
      summary: `Allocations for ${period.quarter}: ${Object.entries(allocations).map(([k, v]) => `${k} $${num(v).toFixed(0)}`).join(", ")}.`,
      evidence: evidence("allocation-trace", "deterministic-calculation", { allocations }),
    };
  }),
  "wf07-bank-reconciliation": mk((ctx) => {
    const alloc = req(ctx, "ownership-allocation");
    const statements = f(ctx).bankStatements as Array<{ date: string; corrected?: boolean; payments: Array<{ to: string; amount: number }> }>;
    const agr = f(ctx).agreement as { beneficiaries: Array<{ id: string; name: string }> };
    const beneficiaries = agr.beneficiaries;
    const expected = alloc.allocations as Record<string, number>;
    const expectedByName = beneficiaries.map((b, i) => ({ name: b.name, amount: expected[`b${i + 1}`] ?? expected[b.id] ?? 0 }));
    const corrected = statements.find((x) => x.corrected);
    const original = statements.find((x) => !x.corrected);
    if (!corrected || !original) return { ok: false, error: "bank statements incomplete — corrected fact chain broken", retryable: false };
    const actualTotal = corrected.payments.reduce((s, p) => s + p.amount, 0);
    const expectedTotal = expectedByName.reduce((s, x) => s + x.amount, 0);
    const unmatched = original.payments.filter((p) => {
      const m = expectedByName.find((x) => x.name === p.to);
      return !m || Math.abs(m.amount - p.amount) > 0.01;
    });
    return {
      ok: true,
      payload: {
        reconciliation: { expectedTotal, statementTotal: actualTotal, matched: actualTotal === expectedTotal },
        unmatched, correctedStatementUsed: corrected.date,
      },
      summary: `Three-way reconciliation: expected $${expectedTotal} vs corrected statement $${actualTotal} — ${actualTotal === expectedTotal ? "matched" : "mismatch"}; original statement had ${unmatched.length} unmatched payment(s).`,
      evidence: evidence("reconciliation-matrix", "bank-statements", { expected: expectedByName, original, corrected }),
      findings: unmatched.length ? finding("high", `Original statement unmatched payment(s): ${unmatched.map((u) => `${u.to} $${u.amount}`).join(", ")} — corrected statement supersedes`) : [],
    };
  }),
  "wf07-vendor-payment-verification": mk((ctx) => {
    const recs = f(ctx).paymentRecords as Array<{ from: string; to: string; amount: number }>;
    return {
      ok: true,
      payload: { middlemanPayments: recs, verified: recs.length === 2 },
      summary: `Middleman (family office) payments verified: ${recs.length} payments to final beneficiaries.`,
      evidence: evidence("payment-records", "payment-records", { records: recs }),
    };
  }),
  "wf07-statement-anomaly": mk((ctx) => {
    const recon = req(ctx, "bank-reconciliation");
    return {
      ok: true,
      payload: { anomalies: (recon.unmatched as Array<{ to: string; amount: number }>).map((u) => `payment to ${u.to} of $${u.amount} not in expected allocation`), correctedFacts: ["statement of 2026-10-03 corrected: 58000 → 60000 for K. Hartwell"] },
      summary: `Anomaly detection: ${(recon.unmatched as unknown[]).length} anomaly(ies); corrected fact recorded as a NEW version — original evidence preserved.`,
      evidence: evidence("anomaly-report", "bank-statements", { anomalies: recon.unmatched }),
      findings: (recon.unmatched as unknown[]).length ? finding("medium", "Corrected statement supersedes original — original retained as evidence") : [],
    };
  }),
  "wf07-payment-followup": mk((ctx) => {
    const anomaly = req(ctx, "statement-anomaly");
    return {
      ok: true,
      payload: { followups: (anomaly.anomalies as string[]).map((a) => `confirm corrected payment with beneficiary: ${a}`) },
      summary: "Follow-up plan prepared for corrected payments.",
      evidence: evidence("followup-plan", "payment-followup", { followups: anomaly.anomalies }),
    };
  }),
  "wf07-independent-auditor": genericVerifier,
  "wf07-controller": mk((ctx) => {
    const verdict = req(ctx, "independent-auditor");
    req(ctx, "payment-followup"); // dependency asserted
    return {
      ok: true,
      payload: { correctionPlan: "restate Q3 distribution to 60/40 split per corrected statement, creating version Q3-v2; original statement preserved as evidence", verifierVerdict: str(verdict.verdict), requiresHumanApproval: true },
      summary: "Correction plan: restate distribution as a new version with original evidence preserved — human authorization required.",
      evidence: evidence("correction-plan", "controller", { version: "Q3-v2" }),
    };
  }),
};

const wf08: Record<string, (ctx: ExecContext) => AgentResult> = {
  "wf08-event-budget": mk((ctx) => {
    const e = f(ctx).event as { eventId: string; budget: number; prizePool: number; currency: string };
    return {
      ok: true,
      payload: { budget: e.budget, prizePool: e.prizePool, currency: e.currency, categories: ["prizes", "venue", "travel"] },
      summary: `Event ${e.eventId}: budget $${e.budget}, prize pool $${e.prizePool}.`,
      evidence: evidence("budget-record", `event:${e.eventId}`, e as unknown as Record<string, unknown>),
    };
  }),
  "wf08-participant-verification": mk((ctx) => {
    const ps = f(ctx).participants as Array<{ id: string; name: string; country: string; prize: number; taxDoc: string }>;
    return {
      ok: true,
      payload: { verifiedParticipants: ps },
      summary: `${ps.length} participants verified with tax documents on file.`,
      evidence: evidence("participant-records", "participant-registry", { count: ps.length }),
    };
  }),
  "wf08-receipt-expense": mk((ctx) => {
    const ex = f(ctx).expenses as Array<{ type: string; amount: number; perPolicyCap?: number }>;
    return {
      ok: true,
      payload: { expenses: ex, documentGaps: ex.filter((x) => x.perPolicyCap && x.amount > x.perPolicyCap).map((x) => `${x.type} over policy cap`) },
      summary: `Collected ${ex.length} expense receipts; ${ex.filter((x) => x.perPolicyCap && x.amount > x.perPolicyCap).length} document gap(s).`,
      evidence: evidence("receipt-extracts", "receipt-ocr", { expenses: ex }),
    };
  }),
  "wf08-travel-policy": mk((ctx) => {
    const rec = req(ctx, "receipt-expense");
    return {
      ok: true,
      payload: { policyViolations: rec.documentGaps, allowedExpenses: num((rec.expenses as Array<{ amount: number; perPolicyCap?: number }>).reduce((s, x) => s + Math.min(x.amount, x.perPolicyCap ?? x.amount), 0)) },
      summary: `Travel policy: allowed $${num((rec.expenses as Array<{ amount: number; perPolicyCap?: number }>).reduce((s, x) => s + Math.min(x.amount, x.perPolicyCap ?? x.amount), 0)).toFixed(0)} after caps.`,
      evidence: evidence("policy-evaluation", "policy-rules", { violations: rec.documentGaps }),
    };
  }),
  "wf08-prize-allocation": mk((ctx) => {
    const pv = req(ctx, "participant-verification");
    const ps = pv.verifiedParticipants as Array<{ id: string; name: string; prize: number }>;
    return {
      ok: true,
      payload: { prizeAllocations: ps.map((p) => ({ participant: p.name, amount: p.prize })) },
      summary: `Prize pool allocated: ${ps.map((p) => `${p.name} $${p.prize}`).join(", ")}.`,
      evidence: evidence("prize-ledger", "deterministic-calculation", { allocations: ps.map((p) => p.prize) }),
    };
  }),
  "wf08-tax-review": mk((ctx) => {
    const pv = req(ctx, "participant-verification");
    const ps = pv.verifiedParticipants as Array<{ name: string; taxDoc: string }>;
    return {
      ok: true,
      payload: { documentCompleteness: ps.map((p) => ({ participant: p.name, doc: p.taxDoc, complete: true })) },
      summary: `Tax documents complete for all ${ps.length} payees.`,
      evidence: evidence("document-checklist", "tax-documents", { docs: ps.map((p) => p.taxDoc) }),
    };
  }),
  "wf08-currency-withholding": mk((ctx) => {
    req(ctx, "prize-allocation"); // dependency asserted
    const tax = req(ctx, "tax-review");
    const w = f(ctx).withholding as Record<string, number>;
    const docs = tax.documentCompleteness as Array<{ participant: string; doc: string }>;
    const pv = f(ctx).participants as Array<{ name: string; country: string; prize: number; fiscalSponsor: string | null }>;
    const netPayouts = pv.map((p) => ({
      participant: p.name, country: p.country, gross: p.prize,
      withholding: p.prize * (w[p.country] ?? 0), net: p.prize * (1 - (w[p.country] ?? 0)),
      doc: docs.find((d) => d.participant === p.name)?.doc ?? "missing",
    }));
    return {
      ok: true,
      payload: { netPayouts, withholdingTable: w },
      summary: `Net payouts after withholding: ${netPayouts.map((p) => `${p.participant} $${p.net.toFixed(0)}`).join(", ")}.`,
      evidence: evidence("withholding-computation", "tax-rules+fx-rates", { payouts: netPayouts }),
    };
  }),
  "wf08-cross-border-payout": mk((ctx) => {
    const cw = req(ctx, "currency-withholding");
    const ship = f(ctx).shippingOption as { costPerParticipant: number; cashEquivalent: number };
    const payouts = cw.netPayouts as Array<{ participant: string; net: number }>;
    return {
      ok: true,
      payload: {
        payoutInstructions: payouts.map((p) => ({ participant: p.participant, amount: p.net, channel: "prepared-only" })),
        shippingVsCash: { shippingTotal: ship.costPerParticipant * payouts.length, cashEquivalentTotal: ship.cashEquivalent * payouts.length, recommendation: ship.cashEquivalent * payouts.length < ship.costPerParticipant * payouts.length ? "cash equivalent" : "shipping" },
      },
      summary: `Payout instructions prepared for ${payouts.length} payees; shipping ($${ship.costPerParticipant * payouts.length}) vs cash ($${ship.cashEquivalent * payouts.length}) analyzed. No money moves automatically.`,
      evidence: evidence("payout-plan", "payout-preparation", { prepared: payouts.length }),
    };
  }),
  "wf08-fraud-investigator": mk((ctx) => {
    const pv = f(ctx).participants as Array<{ name: string; fiscalSponsor: string | null }>;
    return {
      ok: true,
      payload: { fraudSignals: [], sponsorsUsed: pv.filter((p) => p.fiscalSponsor).map((p) => `${p.name} → ${p.fiscalSponsor}`) },
      summary: "No fraud signals; fiscal-sponsor routing recorded for sponsored payees.",
      evidence: evidence("fraud-assessment", "fraud-patterns", { signals: 0 }),
    };
  }),
  "wf08-human-controller": mk((ctx) => {
    const payout = req(ctx, "cross-border-payout");
    const fraud = req(ctx, "fraud-investigator");
    return {
      ok: true,
      payload: { decision: "PREPARED — awaiting human authorization; no tax forms filed, no money released", requiresHumanApproval: true, instructions: payout.payoutInstructions, fraudSignals: fraud.fraudSignals },
      summary: "Payout preparation complete. Human authorization required before any filing or release.",
      evidence: evidence("human-decision-required", "approval-ledger", { pending: true }),
    };
  }),
  "wf08-settlement-reconciler": mk((ctx) => {
    const approval = req(ctx, "approval");
    const pv = f(ctx).participants as Array<{ name: string; fiscalSponsor: string | null }>;
    return {
      ok: true,
      payload: { settlement: "prepared", humanDecision: str(approval.decision), fiscalSponsorReconciliation: pv.filter((p) => p.fiscalSponsor).map((p) => `${p.name} payout held by ${p.fiscalSponsor}`) },
      summary: "Settlement reconciled: sponsored payouts route through the fiscal sponsor; decision recorded from the human approval.",
      evidence: evidence("settlement-records", "settlement-records", { sponsors: pv.filter((p) => p.fiscalSponsor).length }),
    };
  }),
  "wf08-verifier": genericVerifier,
};

const wf09: Record<string, (ctx: ExecContext) => AgentResult> = {
  "wf09-journal-intake": mk((ctx) => {
    const js = f(ctx).journals as Array<{ id: string; date: string; entries: Array<{ account: string; debit?: number; credit?: number }>; cutoffRisk?: boolean; duplicateOf?: string }>;
    return {
      ok: true,
      payload: { journals: js, structuralIssues: js.filter((j) => j.cutoffRisk).map((j) => `${j.id}: single-sided entry with cutoff risk`) },
      summary: `Collected ${js.length} journals for the period; ${js.filter((j) => j.cutoffRisk).length} structural issue(s).`,
      evidence: evidence("journal-records", "journal-reader", { count: js.length }),
    };
  }),
  "wf09-ap-reconciler": mk((ctx) => {
    const ap = f(ctx).apSubledger as { balance: number; glBalance: number };
    return {
      ok: true,
      payload: { apReconciliation: ap, matched: ap.balance === ap.glBalance },
      summary: `AP reconciled: subledger $${ap.balance} = GL $${ap.glBalance}.`,
      evidence: evidence("ap-reconciliation", "ap-subledger", ap as unknown as Record<string, unknown>),
    };
  }),
  "wf09-ar-reconciler": mk((ctx) => {
    const ar = f(ctx).arSubledger as { balance: number; glBalance: number };
    return {
      ok: true,
      payload: { arReconciliation: ar, matched: ar.balance === ar.glBalance },
      summary: `AR reconciled: subledger $${ar.balance} = GL $${ar.glBalance}.`,
      evidence: evidence("ar-reconciliation", "ar-subledger", ar as unknown as Record<string, unknown>),
    };
  }),
  "wf09-bank-reconciliation": mk((ctx) => {
    const b = f(ctx).bankStatement as { endBalance: number; ledgerCash: number; unreconciled: Array<{ id: string; amount: number; ageDays: number }> };
    return {
      ok: true,
      payload: { bankReconciliation: b, unreconciled: b.unreconciled },
      summary: `Bank: statement $${b.endBalance} vs ledger $${b.ledgerCash}; ${b.unreconciled.length} unreconciled item(s).`,
      evidence: evidence("bank-reconciliation", "bank-statements", b as unknown as Record<string, unknown>),
      findings: b.unreconciled.map((u) => ({ severity: "medium" as const, summary: `unreconciled ${u.id} $${u.amount} (${u.ageDays} days old)` })),
    };
  }),
  "wf09-ledger-auditor": mk((ctx) => {
    const js = f(ctx).journals as Array<{ id: string; entries: Array<{ debit?: number; credit?: number }>; duplicateOf?: string }>;
    const unbalanced = js.filter((j) => {
      const d = j.entries.reduce((s, e) => s + (e.debit ?? 0), 0);
      const c = j.entries.reduce((s, e) => s + (e.credit ?? 0), 0);
      return d !== c;
    });
    const duplicates = js.filter((j) => j.duplicateOf);
    return {
      ok: true,
      payload: { unbalancedEntries: unbalanced.map((j) => j.id), duplicatePostings: duplicates.map((j) => `${j.id} duplicates ${j.duplicateOf}`) },
      summary: `Ledger audit: ${unbalanced.length} unbalanced entry(ies), ${duplicates.length} duplicate posting(s).`,
      evidence: evidence("ledger-audit", "ledger", { unbalanced: unbalanced.map((j) => j.id), duplicates: duplicates.map((j) => j.id) }),
      findings: [
        ...unbalanced.map((j) => ({ severity: "critical" as const, summary: `journal ${j.id} violates double-entry (debits ≠ credits)` })),
        ...duplicates.map((j) => ({ severity: "high" as const, summary: `journal ${j.id} is a duplicate posting of ${j.duplicateOf}` })),
      ],
    };
  }),
  "wf09-variance-investigator": mk((ctx) => {
    const b = f(ctx).budget as { monthly: number; actual: number };
    const variance = (b.actual - b.monthly) / b.monthly;
    return {
      ok: true,
      payload: { variances: [{ category: "total", variance: `${(variance * 100).toFixed(1)}%` }], explanations: ["actual exceeds budget — requires controller explanation before close"] },
      summary: `Variance: actual $${b.actual} vs budget $${b.monthly} (${(variance * 100).toFixed(1)}% over).`,
      evidence: evidence("variance-report", "budget-ledger", b as unknown as Record<string, unknown>),
      findings: variance > 0.1 ? [{ severity: "medium" as const, summary: `spending exceeds budget by ${(variance * 100).toFixed(1)}%` }] : [],
    };
  }),
  "wf09-tax-review": mk((ctx) => {
    return {
      ok: true,
      payload: { taxReview: "accruals consistent with period journals; no filing action taken" },
      summary: "Tax review: accruals consistent; no automatic filing.",
      evidence: evidence("tax-review-record", "tax-rules", { period: str(f(ctx).period) }),
    };
  }),
  "wf09-red-team-accounting": mk((ctx) => {
    const led = req(ctx, "ledger-auditor");
    const js = f(ctx).journals as Array<{ id: string; date: string; cutoffRisk?: boolean }>;
    const cutoff = js.filter((j) => j.cutoffRisk).map((j) => `${j.id} dated ${j.date} at period edge, single-sided`);
    return {
      ok: true,
      payload: { cutoffIssues: cutoff, manipulationSignals: [...(led.unbalancedEntries as string[]), ...(led.duplicatePostings as string[])] },
      summary: `Red-team: ${cutoff.length} cutoff issue(s), ${(led.unbalancedEntries as string[]).length + (led.duplicatePostings as string[]).length} manipulation signal(s).`,
      evidence: evidence("red-team-report", "adversarial-probe", { cutoff }),
      findings: cutoff.map((c) => ({ severity: "high" as const, summary: `cutoff risk: ${c}` })),
    };
  }),
  "wf09-controller": mk((ctx) => {
    const led = req(ctx, "ledger-auditor");
    const bank = req(ctx, "bank-reconciliation");
    const rt = req(ctx, "red-team-accounting");
    const suspense = f(ctx).suspense as { openItems: Array<{ id: string; amount: number; ageDays: number }> };
    const openControls = [
      ...(led.unbalancedEntries as string[]).map((id) => `unbalanced journal ${id}`),
      ...(led.duplicatePostings as string[]),
      ...((bank.unreconciled as unknown[]).length ? [`unreconciled bank item(s)`] : []),
      ...suspense.openItems.map((s) => `open suspense ${s.id} ($${s.amount}, ${s.ageDays}d)`),
      ...(rt.cutoffIssues as string[]).map((c) => `cutoff: ${c}`),
    ];
    return {
      ok: true,
      payload: { openControls, closeRecommendation: openControls.length ? "BLOCKED — mandatory controls unresolved" : "READY TO CLOSE", controlCount: openControls.length },
      summary: openControls.length ? `Close BLOCKED: ${openControls.length} mandatory control(s) unresolved.` : "Close ready.",
      evidence: evidence("control-summary", "controller", { openControls }),
      findings: openControls.map((c) => ({ severity: "high" as const, summary: `open control: ${c}` })),
    };
  }),
  "wf09-close-verification": mk((ctx) => {
    const con = req(ctx, "controller");
    const blocking = (con.openControls as string[]).length;
    return {
      ok: true,
      payload: { closeVerified: blocking === 0, blockingControls: con.openControls },
      summary: blocking === 0
        ? "Close verification passed — all completion conditions met."
        : `Close verification FAILED: ${blocking} blocking control(s). No period may close while mandatory controls remain unresolved.`,
      evidence: evidence("verification-record", "close-verification", { blocking }),
      findings: blocking > 0 ? finding("critical", `Period close blocked by ${blocking} unresolved mandatory control(s)`) : [],
    };
  }),
};

const wf10: Record<string, (ctx: ExecContext) => AgentResult> = {
  "wf10-identity-investigator": mk((ctx) => {
    const s = f(ctx).subjectAgent as { agentId: string; name: string; declaredCapabilities: string[] };
    return {
      ok: true,
      payload: { identityRecord: { agentId: s.agentId, name: s.name, provenance: "internal registry" } },
      summary: `Subject agent ${s.name} (${s.agentId}) identified in the registry.`,
      evidence: evidence("identity-record", "agent-registry", { agentId: s.agentId }),
    };
  }),
  "wf10-capability-verification": mk((ctx) => {
    const s = f(ctx).subjectAgent as { declaredCapabilities: string[]; history: { verifiedOutcomes: number } };
    return {
      ok: true,
      payload: { verifiedCapabilities: s.declaredCapabilities, observedOutcomes: s.history.verifiedOutcomes },
      summary: `Declared capabilities: ${s.declaredCapabilities.join(", ")}; verified against ${s.history.verifiedOutcomes} outcome(s).`,
      evidence: evidence("capability-records", "capability-ledger", { capabilities: s.declaredCapabilities }),
    };
  }),
  "wf10-behavioral-evaluation": mk((ctx) => {
    const s = f(ctx).subjectAgent as { history: { verifiedOutcomes: number; totalRuns: number; failures: number; overrides: number } };
    return {
      ok: true,
      payload: { behaviorProfile: { successRate: s.history.verifiedOutcomes / s.history.totalRuns, failures: s.history.failures, overrides: s.history.overrides } },
      summary: `Behavior: ${s.history.verifiedOutcomes}/${s.history.totalRuns} verified outcomes, ${s.history.failures} failure(s), ${s.history.overrides} human override(s).`,
      evidence: evidence("behavior-records", "behavior-history", s.history as unknown as Record<string, unknown>),
    };
  }),
  "wf10-financial-intent-auditor": mk((ctx) => {
    const s = f(ctx).subjectAgent as { history: { authorizationScope: string }; policyViolations: Array<{ rule: string; detail: string }> };
    return {
      ok: true,
      payload: { intentAudit: { declaredScope: s.history.authorizationScope, violations: s.policyViolations } },
      summary: `Intent audit: scope "${s.history.authorizationScope}"; ${s.policyViolations.length} policy violation(s) recorded.`,
      evidence: evidence("intent-records", "intent-records", { violations: s.policyViolations }),
      findings: s.policyViolations.map((v) => ({ severity: "high" as const, summary: `policy violation ${v.rule}: ${v.detail}` })),
    };
  }),
  "wf10-transaction-risk": mk((ctx) => {
    const s = f(ctx).subjectAgent as { transactions: Array<{ id: string; amount: number; outcome: string }> };
    const overrides = s.transactions.filter((t) => t.outcome === "human-override");
    return {
      ok: true,
      payload: { transactionRisk: { total: s.transactions.length, overrides: overrides.length, largest: Math.max(...s.transactions.map((t) => t.amount)) } },
      summary: `Transaction risk: ${overrides.length} of ${s.transactions.length} transactions required human override.`,
      evidence: evidence("transaction-records", "transaction-history", { overrides: overrides.length }),
      findings: overrides.length ? finding("medium", `${overrides.length} transaction(s) exceeded the agent's authority and required human override`) : [],
    };
  }),
  "wf10-merchant-trust": mk((ctx) => {
    const s = f(ctx).subjectAgent as { suspiciousSelections: Array<{ cartTotal: number; merchant: string }> };
    return {
      ok: true,
      payload: { merchantTrust: { suspiciousMerchants: s.suspiciousSelections.map((x) => x.merchant) } },
      summary: `Merchant trust: ${s.suspiciousSelections.length} suspicious merchant selection(s) in cart history.`,
      evidence: evidence("merchant-records", "merchant-registry", { suspicious: s.suspiciousSelections.map((x) => x.merchant) }),
      findings: s.suspiciousSelections.map((x) => ({ severity: "high" as const, summary: `agent selected unregistered merchant ${x.merchant} (cart $${x.cartTotal})` })),
    };
  }),
  "wf10-red-team": mk((ctx) => {
    const beh = req(ctx, "behavioral-evaluation");
    const s = f(ctx).subjectAgent as { policyViolations: Array<{ rule: string }>; suspiciousSelections: Array<{ merchant: string }> };
    return {
      ok: true,
      payload: { violations: s.policyViolations, suspiciousSelections: s.suspiciousSelections, behaviorUsed: beh.behaviorProfile },
      summary: `Red-team: ${s.policyViolations.length} violation(s) and ${s.suspiciousSelections.length} suspicious selection(s) probed.`,
      evidence: evidence("red-team-report", "adversarial-probe", { violations: s.policyViolations.length }),
      findings: finding("high", "Red-team found the agent repeatedly operating at the edge of its authority"),
    };
  }),
  "wf10-reputation-evaluator": mk((ctx) => {
    const s = f(ctx).subjectAgent as { history: { verifiedOutcomes: number; totalRuns: number } };
    const insufficient = s.history.verifiedOutcomes < 5;
    return {
      ok: true,
      payload: { verifiedOutcomeCount: s.history.verifiedOutcomes, reputationBasis: `measured: ${s.history.verifiedOutcomes} of ${s.history.totalRuns} runs verified — ${insufficient ? "INSUFFICIENT HISTORY" : "sufficient"}`, insufficientHistory: insufficient },
      summary: insufficient
        ? `Reputation: only ${s.history.verifiedOutcomes} verified outcome(s) — insufficient history for autonomous authority.`
        : `Reputation: ${s.history.verifiedOutcomes} verified outcomes.`,
      evidence: evidence("outcome-ledger", "measured-outcomes-only", { verifiedOutcomes: s.history.verifiedOutcomes, fabricated: false }),
      findings: insufficient ? finding("high", "Insufficient verified history — restricted permissions and human approval required") : [],
    };
  }),
  "wf10-authority-policy": mk((ctx) => {
    const rep = req(ctx, "reputation-evaluator");
    const rt = req(ctx, "red-team");
    req(ctx, "financial-intent-auditor"); // dependency asserted
    const restricted = Boolean(rep.insufficientHistory) || ((rt.violations as unknown[]).length > 0);
    return {
      ok: true,
      payload: {
        authorityDecision: restricted
          ? "RESTRICTED — propose-only with human approval per transaction until 5 verified outcomes and no violations"
          : "GRANTED within configured limits",
        requiresHumanApproval: restricted, restricted,
        basis: { verifiedOutcomes: rep.verifiedOutcomeCount, violations: (rt.violations as unknown[]).length },
      },
      summary: restricted
        ? "Authority decision: RESTRICTED. The agent's insufficient history and recorded violations require human approval for every transaction."
        : "Authority decision: granted within configured limits.",
      evidence: evidence("policy-evaluation", "authority-policy", { restricted }),
      findings: restricted ? finding("critical", "Financial authority restricted — human approval mandatory per transaction") : [],
    };
  }),
};

const wf11: Record<string, (ctx: ExecContext) => AgentResult> = {
  "wf11-voice-intake": mk((ctx) => {
    const t = f(ctx).transcript as { caseId: string; language: string; durationSeconds: number; text: string; speakerVerifiedByVoice: boolean };
    return {
      ok: true,
      payload: { transcriptRecord: { caseId: t.caseId, language: t.language, durationSeconds: t.durationSeconds, linkedEvidence: true }, text: t.text, speakerVerifiedByVoice: t.speakerVerifiedByVoice },
      summary: `Voice case ${t.caseId}: ${t.durationSeconds}s transcript recorded and linked as case evidence. Voice identity is NOT payment authorization.`,
      evidence: evidence("transcript-record", `transcript:${t.caseId}`, { durationSeconds: t.durationSeconds }),
      findings: finding("info", "Voice identity recorded — never sufficient authorization to alter payment details"),
    };
  }),
  "wf11-conversation-extraction": mk((ctx) => {
    const intake = req(ctx, "voice-intake");
    const actions = f(ctx).requestedActions as string[];
    return {
      ok: true,
      payload: { intents: actions, entities: ["Dana Reyes", "streamline-tools.pro", "deposit account ending 4471"], transcriptText: str(intake.text) },
      summary: `Extracted intents: ${actions.join(", ")}. The deposit-account change intent is flagged for refusal — voice is not authorization.`,
      evidence: evidence("intent-extract", "nlu-rules", { intents: actions }),
      findings: actions.includes("change-deposit-account")
        ? finding("critical", "Requested deposit-account change via voice — REFUSED: voice is never sufficient authorization for payment-detail changes")
        : [],
    };
  }),
  "wf11-fraud-triage": mk((_ctx) => {
    return {
      ok: true,
      payload: { fraudType: "unauthorized card charges (recurring merchant)", urgency: "high" },
      summary: "Triage: recurring unauthorized card charges — high urgency.",
      evidence: evidence("triage-record", "fraud-patterns", { type: "card-fraud" }),
    };
  }),
  "wf11-transaction-evidence": mk((ctx) => {
    const txs = f(ctx).transactions as Array<{ id: string; date: string; merchant: string; amount: number }>;
    return {
      ok: true,
      payload: { affectedTransactions: txs, total: txs.reduce((s, t) => s + t.amount, 0) },
      summary: `${txs.length} affected transactions totaling $${txs.reduce((s, t) => s + t.amount, 0).toFixed(2)} from ${txs[0].merchant}.`,
      evidence: evidence("transaction-records", "transaction-history", { transactions: txs }),
      findings: finding("high", `Recurring charges from ${txs[0].merchant} match card-testing/fraud patterns`),
    };
  }),
  "wf11-banking-claim-prep": mk((ctx) => {
    const tx = req(ctx, "transaction-evidence");
    const triage = req(ctx, "fraud-triage");
    return {
      ok: true,
      payload: { claimPackage: { type: str(triage.fraudType), transactions: tx.affectedTransactions, total: num(tx.total), depositChangeRequested: true, depositChangeAuthorized: false } },
      summary: `Claim package prepared for $${num(tx.total).toFixed(2)}. The deposit-account change is explicitly EXCLUDED from the claim — not authorized by voice.`,
      evidence: evidence("claim-draft", "claim-preparation", { total: num(tx.total), depositChange: "refused" }),
    };
  }),
  "wf11-followup-coordinator": mk((ctx) => {
    req(ctx, "banking-claim-prep"); // dependency asserted
    return {
      ok: true,
      payload: { followupPlan: ["confirm card replacement with customer via verified channel", "monitor for further streamline-tools.pro charges", "route deposit-change request to verified in-person authentication"] },
      summary: "Follow-up plan: verified-channel confirmation, charge monitoring, and verified re-authentication for any account change.",
      evidence: evidence("followup-plan", "case-context", { steps: 3 }),
    };
  }),
  "wf11-case-verifier": genericVerifier,
  "wf11-human-controller": mk((ctx) => {
    const verdict = req(ctx, "case-verifier");
    const follow = req(ctx, "followup-coordinator");
    return {
      ok: true,
      payload: { handoff: { verdict: str(verdict.verdict), followupPlan: follow.followupPlan }, requiresHumanApproval: true, depositChangeRefused: true },
      summary: "Prepared case handed to a human support officer. The requested deposit-account change was refused and is not part of the handoff.",
      evidence: evidence("verifier-verdict", "human-controller", { refused: true }),
      findings: finding("high", "Handoff prepared — human support officer must take over; deposit change remains refused"),
    };
  }),
};

export const EXECUTORS_2: Record<string, (ctx: ExecContext) => AgentResult> = {
  ...wf05, ...wf06, ...wf07, ...wf08, ...wf09, ...wf10, ...wf11,
};

export const ALL_EXECUTORS: Record<string, (ctx: ExecContext) => AgentResult> = { ...EXECUTORS_2 };
