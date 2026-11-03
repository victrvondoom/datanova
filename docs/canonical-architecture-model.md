# Canonical Architecture Model (Campaign 03)

**Implementation:** `apps/web/src/lab/model.ts` (+ seed architectures in `samples.ts`).
This document describes the model as implemented; every claim here is backed by
tests in `apps/web/src/lab/__tests__/m1.test.ts`.

## Purpose

One typed, validated, versioned representation of an architecture consumed by
EVERY Lab engine (intent, causal, blast radius, genome, mutations,
counterfactual, traffic, latency, SLO, resources, trade-offs, consistency,
ownership, events, idempotency, saga, trust, lineage, authorization, tenant,
adversarial, observability, trace, flight recorder, drift, runbook, chaos,
test synthesis, orchestrator, recovery, scorecard, explanations, challenges,
critic, debate, mission, benchmark, packages, extensions, capstone).
No engine keeps a private architecture format.

## Entities

- **Component** (`id`, `kind`, `name`, `purpose?`, `config`, `zoneId?`,
  `requirementIds`, `telemetry?`). Kinds: client, gateway, service, worker,
  queue, cache, database, objectstore, broker, analytics, external.
- **Connection** (`from`, `to`, `kind: sync|async|event`, `criticality 1..5`,
  `failureBehavior: blocks|degrades|isolated`, `latencyMs?`, `controls?`
  (authn/authz/encryption/validation/ratelimit), `access?: read|write|readwrite`,
  `operationIds`, `requirementIds`, `securityNote?` for documented exceptions).
- **Requirement** with kind (functional/nfr/constraint/risk/objective),
  category (latency, throughput, availability, consistency, security, privacy,
  cost, deployment, ops-skill, regulatory, functionality), and a MANDATORY
  reviewable acceptance condition. `unresolved` requirements stay visible.
- **Assumption** with source, confidence 0..1, owner, and status
  (unverified/validated/refuted) — never dressed up as measurements.
- **ADR** with context, decision, status, motivating requirementIds (validated
  — an ADR without motivation is an error), and rejected alternatives.
- **BusinessOperation** with criticality 1..5.
- **DataEntity** (owner, classification public/internal/sensitive/pii,
  retention, copies, tenantScoped) + **EventContract**/**ConsumerBinding**
  (versioned fields with `addedIn`) + **TrustZone** (internet/dmz/trusted/
  privileged) + **SloTarget** + **LatencyBudget** + **ConsistencyContract** +
  **PolicyRule** (default deny).

## Invariants (all enforced by `validateModel` and tested)

- Unique ids; known kinds/categories/enums; criticality in 1..5.
- Connection endpoints exist; no self-connections; sync connections cannot
  target queues.
- Every `requirementIds` reference resolves on ANY entity — dangling intent
  references are validation errors, not silent no-ops.
- ADRs must reference at least one requirement (decision lineage).
- Assumption confidence in 0..1; SLO windows and volumes positive.
- Consistency contracts and policies must reference existing operations,
  entities, and requirements.

## Versioning and migration

`MODEL_VERSION = 1` with `migrateModel()`: older versions migrate forward in one
place; NEWER versions are rejected loudly (`ModelFormatError`) — no silent
schema migration. `serializeModel`/`parseModel` round-trip the full intent
model; parse validates before returning.

## Diff

`diffModels` produces classified changes (structural / behavioral / reliability
/ security / cost / documentation) used by the ledger (T04), drift detector
(T29), and counterfactual controlled-variable isolation (T08).

## Findings

Every engine returns `Finding {id, severity, title, detail, evidence[], source}`
where evidence names exact entities (`component:x`, `requirement:y`,
`connection:z`, `rule:r`). One generic renderer presents any analysis, and
"evidence before claims" is structural, not stylistic.

## State integrity

- Stable IDs assigned once (`newId`), never regenerated.
- Snapshots deep-clone (`cloneModel`); recorded history is immutable; restore
  returns fresh clones (tested).
- Imports are data only: nothing in a model is ever executed; malformed imports
  are rejected with precise errors.
