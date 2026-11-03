# Workflow Agent Matrix

110 specialized agents across 11 named financial workflows. Every agent is a
deterministic rule executor (`model.kind = "deterministic-rules"`, version
`rules-v1` or bespoke logic) with a full capability manifest in
`apps/web/src/agents/catalog.ts`. **Every agent is propose-only
(authorityLimit = 0): no agent can finalize a financial action.**

Sensitive agents (⚑) are preceded or followed by a human-approval checkpoint
and are per-node gated in supervised mode.

## 01 — GPU & Cloud Billing Audit (8 agents)
Intake → {GPU Lifecycle Auditor ∥ Usage Auditor ∥ Contract Auditor} → Cost
Allocator → Billing Reconciler → Independent Verifier → Controller⚑ →
Human approval → Dispute decision.
Key computed result (synthetic case GPU-2026-10-001): billed $3,600, supported
$2,400, unsupported $1,200 — "Dispute $1200.00, pay $2400.00".

| Agent | Role | Evidence required |
|---|---|---|
| wf01-intake | Billing Intake | invoice-record |
| wf01-gpu-lifecycle | GPU Lifecycle Auditor | lifecycle-events |
| wf01-usage | Usage Auditor | job-records |
| wf01-contract | Contract Auditor | contract-clauses (cites §4.2, §7.1) |
| wf01-cost-allocator | Cost Allocator | allocation-trace |
| wf01-reconciler | Billing Reconciler | reconciliation-matrix |
| wf01-verifier | Independent Verifier | independent-recomputation |
| wf01-controller ⚑ | Controller Agent | dispute-recommendation |

## 02 — Invoice Passport & Accounts Payable (12 agents)
Intake → {Sender Auth ∥ Vendor Identity ∥ Duplicate ∥ PO Match ∥ Delivery ∥
Contract Terms} → Bank Destination → condition(bank changed?) → Insider Risk
→ Passport Assembly → Verifier → Payment Controller⚑ → Human approval →
Passport decision. Synthetic case: bank account changed → **HELD**; booking is
never allowed on model opinion alone.

## 03 — Vendor Bank-Change Investigation (8 agents)
Intake → {Identity ∥ Historical Bank ∥ Adversarial Email} → Trusted Contact
(independent registry number only — the request's own phone/link is ignored)
→ Fraud Detection → Verifier → Human Controller⚑ → Human approval → Hold
decision. Payment hold maintained pending authorized human decision.

## 04 — Expense & Reimbursement (11 agents)
Claim → Receipt Extraction → {Policy Audit ∥ Duplicate Detection ∥ FX} →
Tax/Budget/Fraud → Reimbursement Preparer (approved $540, rejected $189,
expected net $432 after 20% withholding) → Verifier → Human Controller⚑ →
approval → Payout decision. Payout execution disabled (no authorized
integration).

## 05 — Procurement & Agentic Shopping (12 agents)
Request Parser → {Spec Match ∥ Supplier Research ∥ Seller Identity ∥ Price
Benchmark} → Bid Comparison → Vendor Risk → Cart Intent → Red-Team Shopping
(detects the prompt-injection listing and quarantines it as data) → Policy
Controller → Human Approver⚑ → Human approval → Outcome Verification
(honestly reports: no order placed — no authorized purchase integration) →
Purchase decision.

## 06 — Financial Dispute & SLA Credit (12 agents)
Claim → {Entitlement ∥ Telemetry ∥ Usage Evidence ∥ Incidents} → Credit
Calculator ($1,050 from 3 started hours × 10% × $3,500, vs claimed $4,200) →
Confidence & Contradiction Reviewer (internal 91.3% errors vs provider's
99.98% claim) → Verifier → Policy Decision (records policy version
SLA-POLICY-2024.2) → Human Escalation⚑ → approval → Dispute Execution
(filing withheld — connector NOT CONNECTED) → Outcome Reconciler.

## 07 — Trust Accounting & Beneficiary Reconciliation (9 agents)
Agreement Extraction → {Beneficiary Identity ∥ Ownership Allocation (60/40 →
$60k/$40k)} → Bank Reconciliation (three-way; corrected statement supersedes
the original, which is preserved as evidence) → {Middleman Payments ∥
Statement Anomaly} → Follow-up → Independent Auditor → Controller⚑ →
approval → correction plan as a NEW version (Q3-v2).

## 08 — Event Finance & International Payout Preparation (11 agents)
Budget → {Participant Verification ∥ Receipts} → Travel Policy / Prize
Allocation / Tax Documents → Currency & Withholding (DE 15% / IN 20% / US 30%)
→ Cross-Border Payout (shipping $255 vs cash $180 → cash) → Fraud → Human
Controller⚑ → approval → Settlement Reconciler (fiscal-sponsor routing). No
tax forms filed, no money released.

## 09 — Month-End Accounting & Close (10 agents)
Journal Intake → {AP ∥ AR ∥ Bank ∥ Ledger ∥ Variance ∥ Tax} (6-way parallel) →
Red-Team Accounting → Controller⚑ (open controls: unbalanced J-1009,
duplicate J-1012, unreconciled TX-9912, suspense S-77, cutoff J-1007) →
Close Verification (**close BLOCKED — no period closes with unresolved
mandatory controls**) → approval → Close package.

## 10 — AI Agent Trust & Financial Authority (9 agents)
Identity → {Capability ∥ Behavior ∥ Intent ∥ Transaction Risk ∥ Merchant
Trust} → Red-Team → Reputation Evaluator (measured: 3 verified outcomes —
**INSUFFICIENT HISTORY**, never a fabricated score) → Authority Policy⚑ →
approval → Authority decision: **RESTRICTED — propose-only with human
approval per transaction**.

## 11 — Voice-Initiated Financial Fraud Assistance (8 agents)
Voice Intake (transcript = linked evidence; voice ≠ authorization) → Intent
Extraction (deposit-account change request **REFUSED**) → Fraud Triage →
Transaction Evidence (3 × $89.99) → Claim Preparation → Follow-up Coordinator
→ Case Verifier → Human Controller⚑ → approval → Fraud assistance case
handed to a human support officer.

## Parallel groups (measured same-wave execution)

| Workflow | Parallel group | Members |
|---|---|---|
| 01 | audit | lifecycle · usage · contract |
| 02 | checks | sender · vendor · duplicate · PO · delivery · terms |
| 03 | investigate | identity · bank record · email |
| 04 | audit | policy · duplicate · FX |
| 05 | survey | spec · supplier · seller · price |
| 06 | evidence | entitlement · telemetry · usage · incidents |
| 07 | basis / verify | identity+ownership; middleman+anomaly |
| 08 | prep | participants · receipts |
| 09 | recon | AP · AR · bank · ledger · variance · tax |
| 10 | evaluate | capability · behavior · intent · risk · merchants |
