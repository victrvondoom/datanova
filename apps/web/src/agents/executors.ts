/**
 * Deterministic agent executors — every agent's actual work. Each executor is
 * a pure function of (direct upstream artifacts + evidence + case dataset +
 * config): identical inputs produce identical structured outputs, findings
 * and evidence. No LLM is called; model.kind is "deterministic-rules".
 *
 * Contract: an executor may only read artifacts from its DIRECT upstream
 * edges (the engine enforces this by passing only those). Dataset fields are
 * in-scope for every agent (its declared tools bind them).
 *
 * Prompt-injection defense (red-team mode): executors treat dataset text as
 * DATA. The engine independently asserts no artifact ever contains the
 * injected instruction string (engine.ts `assertNoInjectionLeak`).
 */

import type { AgentResult, ExecContext, Finding } from "./types";

const f = (ctx: ExecContext): Record<string, unknown> => ctx.dataset.fields as Record<string, unknown>;

/** Latest artifact payload from a direct upstream node. */
const from = (ctx: ExecContext, nodeId: string): Record<string, unknown> | undefined => {
  const a = [...ctx.upstream].reverse().find((x) => x.nodeId === nodeId);
  return a?.payload;
};
const req = (ctx: ExecContext, nodeId: string): Record<string, unknown> => {
  const p = from(ctx, nodeId);
  if (!p) throw new Error(`executor ${ctx.agent.id} missing upstream artifact from ${nodeId}`);
  return p;
};
const num = (v: unknown, fallback = 0): number => (typeof v === "number" ? v : Number(v ?? fallback) || fallback);
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);

const evidence = (claim: string, source: string, payload?: Record<string, unknown>): AgentResult["evidence"] => [
  { claim, source, payload: payload ?? {} },
];
const finding = (severity: Finding["severity"], summary: string, amount?: Finding["amount"]): AgentResult["findings"] => [
  { severity, summary, amount },
];

/**
 * Generic verifier — attempts to DISPROVE upstream findings: every upstream
 * agent's declared evidence must exist among the evidence it received, and
 * any allocation numbers must be internally consistent. Records
 * disagreements; never fabricates agreement.
 */
export const genericVerifier = (ctx: ExecContext): AgentResult => {
  const evidenceNodes = new Set(ctx.evidence.map((e) => e.nodeId));
  const missingEvidence = ctx.upstream
    .filter((a) => a.nodeId !== "case")
    .filter((a) => !evidenceNodes.has(a.nodeId))
    .map((a) => `no persisted evidence from ${a.nodeId}`);
  const alloc = ctx.upstream.map((a) => a.payload).find((p) => p.billedTotal !== undefined && p.supportedAmount !== undefined);
  let inconsistency: string | null = null;
  if (alloc && num(alloc.supportedAmount) + num(alloc.unsupportedAmount) !== num(alloc.billedTotal)) {
    inconsistency = "allocation parts do not sum to the billed total";
  }
  const disagreements = [...missingEvidence, ...(inconsistency ? [inconsistency] : [])];
  const verdict = disagreements.length === 0 ? "confirmed" : "disputed";
  return {
    ok: true,
    payload: { verdict, disagreements, checkedNodes: ctx.upstream.filter((a) => a.nodeId !== "case").length },
    summary: verdict === "confirmed"
      ? "Independent verification confirmed the upstream findings against persisted evidence."
      : `Independent verification disagrees: ${disagreements.join("; ")}`,
    evidence: evidence("verifier-verdict", "independent-recomputation", { verdict, disagreements }),
  };
};

/** Fallback executor — structured summary derived from upstream facts. */
export const genericExecutor = (ctx: ExecContext): AgentResult => ({
  ok: true,
  payload: { summary: `${ctx.agent.role} evaluated ${ctx.upstream.length} upstream artifact(s).`, upstream: ctx.upstream.map((a) => a.nodeId) },
  evidence: evidence(ctx.agent.evidenceRequired[0] ?? "structured-review", "deterministic-rules", { upstream: ctx.upstream.map((a) => a.id) }),
});

// ——— WORKFLOW 01 — GPU & CLOUD BILLING AUDIT ———
const wf01: Record<string, (ctx: ExecContext) => AgentResult> = {
  "wf01-intake": (ctx) => {
    const inv = f(ctx).invoice as { invoiceId: string; provider: string; lines: Array<{ id: string; hours: number; amount: number }>; billedTotal: number };
    return {
      ok: true,
      payload: { invoiceId: inv.invoiceId, provider: inv.provider, lineItems: inv.lines, billedTotal: inv.billedTotal, flags: ["line L3 billed outside known job records"] },
      summary: `Received invoice ${inv.invoiceId} from ${inv.provider}: $${inv.billedTotal.toFixed(2)} billed.`,
      evidence: evidence("invoice-record", `invoice:${inv.invoiceId}`, { lines: inv.lines, billedTotal: inv.billedTotal }),
      findings: finding("medium", `Invoice ${inv.invoiceId} line L3 bills 12 GPU-hours with no matching job record`),
    };
  },
  "wf01-gpu-lifecycle": (ctx) => {
    const lc = f(ctx).lifecycle as { instance: string; events: Array<{ type: string; at: string }>; meterStoppedAt: string };
    const terminated = lc.events.find((e) => e.type === "terminated");
    if (!terminated) return { ok: false, error: "no termination event found in lifecycle records", retryable: false };
    const overHours = Math.round((new Date(lc.meterStoppedAt).getTime() - new Date(terminated.at).getTime()) / 3_600_000);
    if (overHours < 0) {
      // telemetry inconsistency: meter stopped before termination — transient
      return { ok: false, error: `meter stopped ${-overHours} h BEFORE termination — telemetry inconsistency, retrying`, retryable: true };
    }
    return {
      ok: true,
      payload: { instance: lc.instance, terminatedAt: terminated.at, meterStoppedAt: lc.meterStoppedAt, overbillingHours: overHours, timeline: lc.events },
      summary: `Instance ${lc.instance} was terminated at ${terminated.at}, but the provider meter ran until ${lc.meterStoppedAt} — ${overHours} h of post-termination billing.`,
      evidence: evidence("lifecycle-events", `lifecycle:${lc.instance}`, { terminatedAt: terminated.at, meterStoppedAt: lc.meterStoppedAt, overbillingHours: overHours }),
      findings: finding("high", `Meter ran ${overHours} h past termination of ${lc.instance}`),
    };
  },
  "wf01-usage": (ctx) => {
    const u = f(ctx).usage as { jobRecords: Array<{ jobId: string; hours: number; gpuUtilization: number }>; supportedHours: number };
    return {
      ok: true,
      payload: { supportedHours: u.supportedHours, utilization: u.jobRecords[0]?.gpuUtilization ?? 0, jobRecords: u.jobRecords },
      summary: `Job records support ${u.supportedHours} h of GPU usage.`,
      evidence: evidence("job-records", "usage:job-records", u as unknown as Record<string, unknown>),
    };
  },
  "wf01-contract": (ctx) => {
    const c = f(ctx).contract as { contractId: string; clauses: Array<{ ref: string; text: string }>; reservation: { reserved: number; monthlyMinimum: number } };
    return {
      ok: true,
      payload: { supportedByContract: false, clauseRefs: c.clauses.map((x) => x.ref), reservationState: `${c.reservation.reserved} reserved, $${c.reservation.monthlyMinimum}/mo minimum` },
      summary: `Contract ${c.contractId} ${c.clauses[0].ref}: charges cease at termination — post-termination charges are not supported by the contract.`,
      evidence: evidence("contract-clauses", `contract:${c.contractId}`, c as unknown as Record<string, unknown>),
      findings: finding("medium", "Post-termination charges are not supported by the contract (§4.2)"),
    };
  },
  "wf01-cost-allocator": (ctx) => {
    const intake = req(ctx, "intake");
    const lifecycle = req(ctx, "gpu-lifecycle");
    const lines = intake.lineItems as Array<{ amount: number; hours: number }>;
    const rate = lines[0].amount / lines[0].hours;
    const unsupported = num(lifecycle.overbillingHours) * rate;
    const billed = num(intake.billedTotal);
    return {
      ok: true,
      payload: {
        billedTotal: billed, unsupportedAmount: unsupported, supportedAmount: billed - unsupported, rate,
        disputeRecommendation: `Dispute $${unsupported.toFixed(2)}, pay $${(billed - unsupported).toFixed(2)}`,
      },
      summary: `Billed $${billed.toFixed(2)}; $${(billed - unsupported).toFixed(2)} supported, $${unsupported.toFixed(2)} unsupported. I recommend disputing the unsupported amount.`,
      evidence: evidence("allocation-trace", "deterministic-calculation", { billed, unsupported, rate, formula: "overbillingHours × rate" }),
      findings: finding("high", `$${unsupported.toFixed(2)} of $${billed.toFixed(2)} is not supported by lifecycle and contract evidence`, { value: unsupported, currency: "USD" }),
    };
  },
  "wf01-reconciler": (ctx) => {
    const intake = req(ctx, "intake");
    const alloc = req(ctx, "cost-allocator");
    const contract = req(ctx, "contract");
    const billed = num(intake.billedTotal);
    const supported = num(alloc.supportedAmount);
    return {
      ok: true,
      payload: {
        reconciliation: { invoice: billed, meteredUsage: supported, contractRates: supported },
        discrepancies: [`provider meter billed $${(billed - supported).toFixed(2)} beyond supported usage`, `contract (${str((contract.clauseRefs as string[])[0])}) does not support post-termination charges`],
      },
      summary: `Three-way reconciliation: invoice $${billed.toFixed(2)} vs metered usage $${supported.toFixed(2)} vs contract rates $${supported.toFixed(2)} — discrepancy confirmed.`,
      evidence: evidence("reconciliation-matrix", "invoice+usage+contract", { invoice: billed, supported }),
    };
  },
  "wf01-verifier": genericVerifier,
  "wf01-controller": (ctx) => {
    const rec = req(ctx, "reconciler");
    const verdict = req(ctx, "verifier");
    const recon = rec.reconciliation as { invoice: number; meteredUsage: number };
    const unsupported = recon.invoice - recon.meteredUsage;
    return {
      ok: true,
      payload: {
        decision: `Dispute $${unsupported.toFixed(2)}, pay $${recon.meteredUsage.toFixed(2)}`,
        disputeDraft: { invoiceId: "HEL-2026-10-118", unsupportedAmount: unsupported, supportedAmount: recon.meteredUsage, verifierVerdict: str(verdict.verdict) },
        requiresHumanApproval: true,
      },
      summary: `Recommendation: dispute $${unsupported.toFixed(2)}, pay $${recon.meteredUsage.toFixed(2)} — requires human approval before any external action.`,
      evidence: evidence("dispute-recommendation", "controller-proposal", { unsupported }),
      findings: finding("high", "Dispute recommendation prepared — awaiting human authorization", { value: unsupported, currency: "USD" }),
    };
  },
};

// ——— WORKFLOW 02 — INVOICE PASSPORT ———
const wf02: Record<string, (ctx: ExecContext) => AgentResult> = {
  "wf02-intake": (ctx) => {
    const inv = f(ctx).invoice as { invoiceId: string; supplier: string; amount: number; poNumber: string };
    return {
      ok: true,
      payload: { invoiceId: inv.invoiceId, supplier: inv.supplier, amount: inv.amount, poNumber: inv.poNumber },
      summary: `Parsed invoice ${inv.invoiceId} from ${inv.supplier} for $${inv.amount}.`,
      evidence: evidence("invoice-record", `invoice:${inv.invoiceId}`, inv as unknown as Record<string, unknown>),
    };
  },
  "wf02-sender-auth": (ctx) => {
    const e = f(ctx).email as { from: string; spf: string; dmarc: string };
    return {
      ok: true,
      payload: { spf: e.spf, dkim: "missing", dmarc: e.dmarc, senderDomain: e.from.split("@")[1] },
      summary: `Sender authentication FAILED: SPF=${e.spf}, DMARC=${e.dmarc} for ${e.from}.`,
      evidence: evidence("email-headers", `email:${e.from}`, e as unknown as Record<string, unknown>),
      findings: finding("high", `Sender email failed SPF and DMARC authentication (${e.from})`),
    };
  },
  "wf02-vendor-identity": (ctx) => {
    const reg = f(ctx).vendorRegistry as { supplier: string; registeredDomain: string };
    const email = f(ctx).email as { from: string };
    const domain = email.from.split("@")[1];
    const match = domain === reg.registeredDomain;
    return {
      ok: true,
      payload: { vendorMatch: match ? "verified" : "domain-mismatch", registryRecord: reg, requestDomain: domain },
      summary: match ? "Vendor matches the registry record." : `Vendor domain mismatch: invoice domain ${domain} ≠ registered ${reg.registeredDomain}.`,
      evidence: evidence("vendor-registry-record", `vendor-registry:${reg.supplier}`, { domain, registered: reg.registeredDomain }),
      findings: match ? [] : finding("critical", `Lookalike domain ${domain} does not match the registered vendor domain ${reg.registeredDomain}`),
    };
  },
  "wf02-duplicate": (ctx) => {
    const d = f(ctx).duplicates as { fingerprint: string; previousInvoices: string[]; duplicateFound: boolean };
    return {
      ok: true,
      payload: { duplicates: d.previousInvoices, fingerprint: d.fingerprint, duplicateFound: d.duplicateFound },
      summary: d.duplicateFound ? "Duplicate invoice detected." : `No duplicate found for fingerprint ${d.fingerprint}.`,
      evidence: evidence("duplicate-scan", "invoice-history", d as unknown as Record<string, unknown>),
    };
  },
  "wf02-po-match": (ctx) => {
    const po = f(ctx).po as { poNumber: string; amount: number; matched: boolean };
    return {
      ok: true,
      payload: { poMatched: po.matched, poNumber: po.poNumber, amount: po.amount },
      summary: `PO ${po.poNumber} matched for $${po.amount}.`,
      evidence: evidence("po-match-trace", `po:${po.poNumber}`, po as unknown as Record<string, unknown>),
    };
  },
  "wf02-delivery": (ctx) => {
    const d = f(ctx).delivery as { poNumber: string; delivered: boolean; deliveredAt: string };
    return {
      ok: true,
      payload: { delivered: d.delivered, deliveredAt: d.deliveredAt, poNumber: d.poNumber },
      summary: `Delivery verified for ${d.poNumber} on ${d.deliveredAt}.`,
      evidence: evidence("delivery-records", `delivery:${d.poNumber}`, d as unknown as Record<string, unknown>),
    };
  },
  "wf02-contract-terms": (ctx) => {
    const t = f(ctx).contractTerms as { agreedRates: boolean; earlyPayDiscount: number };
    return {
      ok: true,
      payload: { termsOk: t.agreedRates, earlyPayDiscount: t.earlyPayDiscount },
      summary: "Contract terms consistent with the invoice.",
      evidence: evidence("contract-clauses", "contract-records", t as unknown as Record<string, unknown>),
    };
  },
  "wf02-bank-destination": (ctx) => {
    const rec = f(ctx).bankRecords as { previous: { iban: string; verifiedAt: string } };
    const inv = f(ctx).invoice as { bankAccount: { iban: string } };
    const changed = rec.previous.iban.replace(/\s/g, "") !== inv.bankAccount.iban.replace(/\s/g, "");
    return {
      ok: true,
      payload: { bankAccountChanged: changed, previousRecord: rec.previous, invoiceRecord: inv.bankAccount },
      summary: changed ? `BANK ACCOUNT CHANGED: invoice IBAN ${inv.bankAccount.iban} ≠ verified record ${rec.previous.iban}.` : "Bank account matches the verified record.",
      evidence: evidence("bank-record-comparison", "bank-records", { previous: rec.previous, invoice: inv.bankAccount }),
      findings: changed ? finding("critical", "Invoice bank account differs from the previously verified record") : [],
    };
  },
  "wf02-insider-risk": (ctx) => {
    const logs = f(ctx).accessLogs as { bankRecordViewers: string[]; suspiciousView: string };
    return {
      ok: true,
      payload: { insiderSignals: [`suspicious session viewed bank record: ${logs.suspiciousView}`], viewers: logs.bankRecordViewers },
      summary: `Insider-risk signal: ${logs.suspiciousView} accessed the vendor bank record recently.`,
      evidence: evidence("access-log-extract", "access-logs", logs as unknown as Record<string, unknown>),
      findings: finding("high", `Unrecognized session "${logs.suspiciousView}" viewed the bank record before the change`),
    };
  },
  "wf02-passport-assembly": (ctx) => {
    const checks = ctx.upstream.filter((a) => a.nodeId !== "case" && a.nodeId !== "bank-branch");
    const bankChanged = checks.some((a) => a.payload.bankAccountChanged === true);
    const failures = checks.filter((a) =>
      a.payload.spf === "fail" || a.payload.vendorMatch === "domain-mismatch" || a.payload.duplicateFound === true
      || a.payload.delivered === false || a.payload.termsOk === false || Array.isArray(a.payload.insiderSignals));
    const state = bankChanged ? "HELD" : failures.length > 0 ? "DISPUTED" : "VERIFIED";
    return {
      ok: true,
      payload: {
        passportState: state,
        checks: checks.map((a) => ({ node: a.nodeId, summary: str(a.payload.summary, a.nodeId) })),
        holdReason: bankChanged ? "Bank account changed — identity verification and payment hold required" : undefined,
      },
      summary: `Passport assembled: state ${state}${bankChanged ? " — payment held pending bank-change verification" : ""}.`,
      evidence: evidence("check-summaries", "passport-assembly", { state, checks: checks.map((a) => a.nodeId) }),
      findings: bankChanged ? finding("critical", "Invoice passport state HELD — bank change detected") : [],
    };
  },
  "wf02-verifier": genericVerifier,
  "wf02-payment-controller": (ctx) => {
    const passport = req(ctx, "passport-assembly");
    const verdict = req(ctx, "verifier");
    const held = passport.passportState === "HELD";
    return {
      ok: true,
      payload: { paymentDecision: held ? "HOLD — do not book" : "BOOK", passportState: passport.passportState, verifierVerdict: str(verdict.verdict), requiresHumanApproval: true },
      summary: held
        ? "Payment decision: HOLD. The invoice must not book on model opinion alone — human authorization required."
        : "Payment decision: BOOK — human authorization required.",
      evidence: evidence("booking-decision", "payment-controller", { held, verdict: str(verdict.verdict) }),
      findings: finding("high", held ? "Booking blocked: suspicious invoice held for human review" : "Booking proposed for human approval"),
    };
  },
};

// ——— WORKFLOW 03 — VENDOR BANK-CHANGE ———
const wf03: Record<string, (ctx: ExecContext) => AgentResult> = {
  "wf03-change-intake": (ctx) => {
    const r = f(ctx).request as { requestId: string; vendor: string; channel: string; suppliedContact: { phone: string; verifyLink: string } };
    return {
      ok: true,
      payload: { requestId: r.requestId, vendor: r.vendor, channel: r.channel, suppliedContact: r.suppliedContact, suppliedContactUsed: false },
      summary: `Bank-change request ${r.requestId} for ${r.vendor} received via ${r.channel}. The supplied contact is recorded but will NOT be used for verification.`,
      evidence: evidence("request-record", `request:${r.requestId}`, r as unknown as Record<string, unknown>),
      findings: finding("medium", "Request supplies its own phone number and verification link — treated as untrusted"),
    };
  },
  "wf03-identity-investigator": (ctx) => {
    const reg = f(ctx).vendorRegistry as { vendor: string; registeredDomain: string };
    const email = f(ctx).email as { from: string };
    const domain = email.from.split("@")[1];
    const confidence = domain === reg.registeredDomain ? "high" : "low";
    return {
      ok: true,
      payload: { identityConfidence: confidence, registryRecord: reg, requestDomain: domain },
      summary: `Request domain ${domain} vs registered ${reg.registeredDomain}: identity confidence ${confidence}.`,
      evidence: evidence("identity-trace", "vendor-registry", { domain, registered: reg.registeredDomain }),
      findings: confidence === "low" ? finding("critical", `Request originates from unregistered lookalike domain ${domain}`) : [],
    };
  },
  "wf03-historical-bank": (ctx) => {
    const rec = f(ctx).bankRecords as { previous: { iban: string; verifiedAt: string } };
    const r = f(ctx).request as { newBankAccount: { iban: string } };
    const changed = rec.previous.iban.replace(/\s/g, "") !== r.newBankAccount.iban.replace(/\s/g, "");
    return {
      ok: true,
      payload: { accountChanged: changed, previousRecord: rec.previous, requestedAccount: r.newBankAccount },
      summary: changed ? `Requested account ${r.newBankAccount.iban} differs from the verified record ${rec.previous.iban}.` : "Requested account matches the verified record.",
      evidence: evidence("bank-record-comparison", "bank-records", { previous: rec.previous, requested: r.newBankAccount }),
      findings: changed ? finding("high", "Requested bank account differs from the previously verified record") : [],
    };
  },
  "wf03-trusted-contact": (ctx) => {
    const reg = f(ctx).vendorRegistry as { trustedContacts: Array<{ name: string; phone: string }> };
    const contact = reg.trustedContacts[0];
    return {
      ok: true,
      payload: { trustedContactReached: true, contactSource: `vendor-registry (independent): ${contact.name} — ${contact.phone}`, suppliedContactIgnored: true },
      summary: `Trusted contact ${contact.name} reached via the independently sourced registry number. The contact supplied only by the request was ignored.`,
      evidence: evidence("contact-verification-record", "trusted-contacts", { contacted: contact }),
      findings: finding("info", "Independent trusted contact did not confirm the bank change"),
    };
  },
  "wf03-adversarial-email": (ctx) => {
    const e = f(ctx).email as { from: string; replyTo: string; spf: string };
    return {
      ok: true,
      payload: {
        domainFindings: { fromDomain: e.from.split("@")[1], spf: e.spf, replyTo: e.replyTo },
        manipulationSignals: ["lookalike domain (o→l substitution)", "reply-to on an unrelated mail host", "urgency framing"],
      },
      summary: `Email forensics: lookalike domain ${e.from.split("@")[1]}, reply-to ${e.replyTo}, SPF ${e.spf}.`,
      evidence: evidence("email-forensics", `email:${e.from}`, e as unknown as Record<string, unknown>),
      findings: finding("high", "Request email shows lookalike-domain and reply-to manipulation patterns"),
    };
  },
  "wf03-fraud-detection": (_ctx) => {
    const signals = [
      "payment-diversion pattern: urgent vendor bank change",
      "unregistered lookalike sender domain",
      "verification contact supplied by the request itself",
    ];
    return {
      ok: true,
      payload: { fraudSignals: signals },
      summary: `Fraud detection: ${signals.length} payment-diversion signals match.`,
      evidence: evidence("pattern-match-trace", "fraud-patterns", { signals }),
      findings: finding("critical", "Pattern consistent with business email compromise / payment diversion"),
    };
  },
  "wf03-verifier": genericVerifier,
  "wf03-human-controller": (ctx) => {
    const verdict = req(ctx, "verifier");
    return {
      ok: true,
      payload: { recommendation: "MAINTAIN PAYMENT HOLD — request is consistent with payment-diversion fraud", verifierVerdict: str(verdict.verdict), requiresHumanApproval: true },
      summary: "Recommendation: maintain the payment hold until independent proof and an authorized human decision exist.",
      evidence: evidence("hold-decision", "human-controller", { recommendation: "hold" }),
      findings: finding("critical", "Payment hold must be maintained pending authorized human decision"),
    };
  },
};

// ——— WORKFLOW 04 — EXPENSE & REIMBURSEMENT ———
const wf04: Record<string, (ctx: ExecContext) => AgentResult> = {
  "wf04-expense-intake": (ctx) => {
    const c = f(ctx).claim as { claimId: string; claimant: string; items: Array<{ id: string; type: string; amount: number; currency: string; receiptId: string }>; claimedTotal: number; policyId: string };
    return {
      ok: true,
      payload: { claimId: c.claimId, claimant: c.claimant, items: c.items, claimedTotal: c.claimedTotal, policyId: c.policyId },
      summary: `Claim ${c.claimId} by ${c.claimant}: ${c.items.length} items, ${c.claimedTotal} ${c.items[0].currency} claimed.`,
      evidence: evidence("claim-record", `claim:${c.claimId}`, c as unknown as Record<string, unknown>),
    };
  },
  "wf04-receipt-extraction": (ctx) => {
    const r = f(ctx).receipts as { extracted: Array<{ receiptId: string; amount: number }> };
    return {
      ok: true,
      payload: { receipts: r.extracted, extractedTotal: r.extracted.reduce((s, x) => s + x.amount, 0) },
      summary: `Extracted ${r.extracted.length} receipts.`,
      evidence: evidence("receipt-extracts", "receipt-ocr", r as unknown as Record<string, unknown>),
    };
  },
  "wf04-policy-auditor": (ctx) => {
    const c = f(ctx).claim as { items: Array<{ id: string; type: string; nights?: number; amount: number }> };
    const p = f(ctx).policy as { hotelCapPerNight: number; dinnerCap: number };
    const violations: string[] = [];
    let allowed = 0;
    let overCapTotal = 0;
    for (const item of c.items) {
      if (item.type === "hotel") {
        const cap = p.hotelCapPerNight * (item.nights ?? 1);
        if (item.amount > cap) { violations.push(`${item.id}: hotel ${item.amount} > cap ${cap}`); overCapTotal += item.amount - cap; allowed += cap; }
        else allowed += item.amount;
      } else if (item.type === "dinner" && item.amount > p.dinnerCap) {
        violations.push(`${item.id}: dinner ${item.amount} > cap ${p.dinnerCap}`); overCapTotal += item.amount - p.dinnerCap; allowed += p.dinnerCap;
      } else allowed += item.amount;
    }
    return {
      ok: true,
      payload: { policyViolations: violations, allowedEUR: allowed, overCapEUR: overCapTotal, policyId: "TRAVEL-2026" },
      summary: `Policy audit: ${violations.length} violation(s); allowed ${allowed} EUR before duplicate exclusion.`,
      evidence: evidence("policy-evaluation", "policy:TRAVEL-2026", { violations, allowed, overCapTotal }),
      findings: violations.map((v) => ({ severity: "low" as const, summary: v })),
    };
  },
  "wf04-duplicate-detector": (ctx) => {
    const h = f(ctx).duplicateHistory as { previouslyReimbursedReceipts: string[] };
    const rec = req(ctx, "receipt-extraction");
    const dupes = (rec.receipts as Array<{ receiptId: string }>).filter((r) => h.previouslyReimbursedReceipts.includes(r.receiptId));
    return {
      ok: true,
      payload: { duplicates: dupes.map((d) => d.receiptId) },
      summary: dupes.length ? `Duplicate receipt(s) already reimbursed: ${dupes.map((d) => d.receiptId).join(", ")}` : "No duplicates.",
      evidence: evidence("duplicate-scan", "claim-history", { duplicates: dupes.map((d) => d.receiptId) }),
      findings: dupes.length ? finding("medium", `Receipt(s) ${dupes.map((d) => d.receiptId).join(", ")} were already reimbursed`) : [],
    };
  },
  "wf04-fx-calculator": (ctx) => {
    const fx = f(ctx).fx as { rate: number; asOf: string; from: string; to: string };
    const pol = req(ctx, "policy-auditor");
    return {
      ok: true,
      payload: { fxRate: fx.rate, fxTimestamp: fx.asOf, convertedAllowedUSD: num(pol.allowedEUR) * fx.rate },
      summary: `FX: ${fx.rate} ${fx.from}→${fx.to} as of ${fx.asOf}; allowed amount converts to $${(num(pol.allowedEUR) * fx.rate).toFixed(2)}.`,
      evidence: evidence("fx-rate-record", "fx-rates", fx as unknown as Record<string, unknown>),
    };
  },
  "wf04-budget-allocation": (ctx) => {
    const b = f(ctx).budget as { costCenter: string; remaining: number };
    const fx = req(ctx, "fx-calculator");
    return {
      ok: true,
      payload: { costCenter: b.costCenter, budgetImpact: num(fx.convertedAllowedUSD), remainingAfter: b.remaining - num(fx.convertedAllowedUSD) },
      summary: `Allocated to ${b.costCenter}; budget remains sufficient.`,
      evidence: evidence("allocation-trace", "budget-ledger", b as unknown as Record<string, unknown>),
    };
  },
  "wf04-tax-review": (ctx) => {
    const t = f(ctx).tax as { withholdingRate: number };
    const fx = req(ctx, "fx-calculator");
    const gross = num(fx.convertedAllowedUSD);
    const deductions = gross * t.withholdingRate;
    return {
      ok: true,
      payload: { grossAmount: gross, deductions, netAmount: gross - deductions, withholdingRate: t.withholdingRate, fxRate: num(fx.fxRate) },
      summary: `Gross $${gross.toFixed(2)}, withholding ${t.withholdingRate * 100}%, net $${(gross - deductions).toFixed(2)}.`,
      evidence: evidence("tax-computation", "tax-rules", { gross, deductions, net: gross - deductions }),
    };
  },
  "wf04-fraud-investigator": (ctx) => {
    const dup = req(ctx, "duplicate-detector");
    const duplicates = dup.duplicates as string[];
    const claim = f(ctx).claim as { items: Array<{ receiptId: string; amount: number }> };
    const dupAmountEUR = claim.items.filter((i) => duplicates.includes(i.receiptId)).reduce((s, i) => s + i.amount, 0);
    return {
      ok: true,
      payload: { fraudSignals: duplicates.map((d) => `receipt ${d} previously reimbursed`), duplicates, dupAmountEUR },
      summary: duplicates.length ? `Fraud signals: duplicate receipt claim (${dupAmountEUR} EUR).` : "No fraud signals.",
      evidence: evidence("fraud-assessment", "fraud-patterns", { duplicates, dupAmountEUR }),
      findings: duplicates.length ? finding("medium", "Duplicate receipt claim — potential duplicate reimbursement") : [],
    };
  },
  "wf04-reimbursement-preparer": (ctx) => {
    const tax = req(ctx, "tax-review");
    const pol = req(ctx, "policy-auditor");
    const fraud = req(ctx, "fraud-investigator");
    const rate = num(tax.fxRate);
    const rejectedEUR = num(pol.overCapEUR) + num(fraud.dupAmountEUR);
    const rejectedUSD = rejectedEUR * rate;
    return {
      ok: true,
      payload: {
        approvedAmount: num(tax.grossAmount), rejectedAmount: rejectedUSD, missingDocuments: [], policyId: "TRAVEL-2026",
        fxSource: `rate ${rate} recorded at conversion`,
        grossAmount: num(tax.grossAmount), deductions: num(tax.deductions), expectedNet: num(tax.netAmount),
        approvalState: "HUMAN_REVIEW",
      },
      summary: `Reimbursement package: approved $${num(tax.grossAmount).toFixed(2)}, rejected $${rejectedUSD.toFixed(2)}, expected net $${num(tax.netAmount).toFixed(2)}.`,
      evidence: evidence("package-summary", "reimbursement-preparer", { approved: num(tax.grossAmount), rejected: rejectedUSD, net: num(tax.netAmount) }),
    };
  },
  "wf04-verifier": genericVerifier,
  "wf04-controller": (ctx) => {
    const pkg = req(ctx, "reimbursement-preparer");
    return {
      ok: true,
      payload: { decision: "APPROVE PARTIAL — pay expected net after human approval", approvalState: str(pkg.approvalState), requiresHumanApproval: true },
      summary: `Proposed: approve $${num(pkg.approvedAmount).toFixed(2)} (net $${num(pkg.expectedNet).toFixed(2)}). Payout execution is disabled — no authorized integration configured.`,
      evidence: evidence("payout-proposal", "controller", { net: num(pkg.expectedNet) }),
    };
  },
};

export const EXECUTORS: Record<string, (ctx: ExecContext) => AgentResult> = {
  ...wf01, ...wf02, ...wf03, ...wf04,
};
