# Datanova Evidence Package (DEP) — Format Specification

Campaign 05, Tasks 21–25/37/39. Implementation: `apps/web/src/lab/engines/dep.ts`
(engine, pure and deterministic) + `engines/exchange.ts` (lifecycle).
Tests: `c05-exchange.test.ts` (42 cases). UI: the Evidence Exchange tab.

## 1. Purpose and scope

A DEP is a portable, versioned, integrity-checked, privacy-aware unit of
reviewable architecture evidence: architecture snapshot + assumptions +
scenario + results + evidence artifacts + claim/source metadata. It enables
**offline, file-based user-to-user exchange** — no cloud service, no
backend, no network in the exchange path.

## 2. Package structure (schemaVersion 1)

```
{
  "format": "datanova-evidence-package",
  "schemaVersion": 1,
  "packageId": "dep-<8 hex>",          // content-derived: identical content ⇒ identical id
  "createdAt": "<ISO 8601>",            // caller-supplied
  "createdBy": {                        // attribution ONLY — see §6
    "name": "…", "email?: …", "organization?: …",
    "identity": "self-declared" | "anonymous"
  },
  "modelVersion": 1,                    // canonical ArchitectureModel version
  "archFingerprint": "gn-…",           // genome fingerprint at export time
  "modelJson": "<canonical serialization>",   // validates against the model schema
  "assumptions": [ { "ref": "ASM-1", "statement": "…" } ],
  "scenario": <Scenario> | null,        // replayable (see §8)
  "results": [ { "expectationId", "outcome", "detail" } ],
  "evidence": [ <EvidenceArtifact> ],   // C04 evidence engine artifacts
  "claimIds": [ "claim-…" ],            // claim registry references (must exist)
  "sourceIds": [ "src-…" ],             // source registry references (must exist)
  "redactions": [ "…" ],                // what was redacted and why (recorded)
  "manifest": {
    "format": "datanova-evidence-package",
    "schemaVersion": 1,
    "packageId": "dep-…",
    "createdAt": "…",
    "sections": [                        // one digest per virtual section
      { "path": "model.json", "mediaType": "application/json",
        "byteLength": 1234, "checksum": "<8 hex>", "algorithm": "fnv1a-32" },
      … // assumptions.json, scenario.json, results.json, evidence.json, metadata.json
    ]
  }
}
```

**Required fields:** all except `createdBy.email`, `createdBy.organization`,
`scenario`, and the array contents (which may be empty). Unknown top-level
keys are **rejected** (strict schema), as are unknown keys inside
`createdBy` and `manifest`.

**Stable identifiers:** package id derives from content; component,
requirement, connection, evidence, and claim ids are the canonical model /
registry ids — diffs and annotations are id-keyed, never order-keyed.

## 3. Determinism and serialization

- `serializeDep` emits **canonical JSON**: sorted keys, no whitespace,
  `undefined` omitted. Identical input ⇒ byte-identical output (tested).
- `buildDepPackage` recomputes the manifest so a package is always
  internally consistent; timestamps are caller-supplied (engine purity).

## 4. Integrity model — honest security boundaries (Task 23)

- The manifest checksums (fnv1a-32 per section) detect **accidental
  corruption and naive tampering**: any modified section fails
  `checksum mismatch` on import (tested with a falsified results section).
- **A CHECKSUM IS NOT A SIGNATURE.** It is not collision-resistant, and a
  determined attacker can recompute it. The project has no signing library
  or key-management infrastructure, so **author authenticity is explicitly
  unsupported** — packages never claim `signature`/`authentic` metadata,
  and identity is labeled self-declared/anonymous only.
- Content digests additionally bind review responses to the exact package
  version they reviewed (see §7).

## 5. Import safety (Tasks 24/36) — every package is untrusted

`validateDep(text)` runs entirely in isolation; nothing touches workspace
state until the caller stages an accepted package. Rejections:

- size > 512 KB; JSON nesting > 16; evidence > 200; assumptions > 100;
  results > 50; strings > 200,000 chars;
- malformed JSON (parser exceptions caught, never crash);
- **prototype pollution**: `__proto__` / `constructor` / `prototype` keys
  rejected anywhere in the structure (hand-written malicious JSON tested);
- unknown top-level / author / manifest keys (strict schema);
- `schemaVersion` > supported ⇒ safe failure with "upgrade Datanova"
  guidance; < supported range ⇒ rejected;
- manifest path shape (`/^[\w.-]+\.json$/`), checksum algorithm, byte
  length, and per-section checksums verified;
- embedded `modelJson` must pass canonical model validation;
- `sourceIds`/`claimIds` must exist in the shipped registries — a package
  cannot smuggle fabricated citations;
- on ANY problem: `valid: false`, `preview: null` — the original workspace
  is untouched (tested).

Import is staged in the UI: validate → preview (sender, components,
evidence counts, scenario presence) → receive → inspect → accept/reject;
the working architecture is replaced **only** on explicit acceptance.

## 6. Privacy and redaction (Task 25)

- **Default exclusions:** `createdBy.email` is omitted unless the author
  explicitly opts in; every applied redaction is recorded in `redactions`.
- `inspectSensitive` scans for email-like strings and credential-like keys
  (password/secret/token/api-key) across author metadata, model config,
  and evidence summaries; the export screen shows findings before sharing.
- Redaction preserves technical reproducibility: model + scenario bytes are
  identical with and without the author email (tested).
- Retention basis: GDPR Art. 5 minimisation/storage limitation (claim
  `claim-data-minimisation`; engineering interpretation, not legal advice).
- Deletion (Task 40): received packages and their local annotations are
  deletable; outbox attribution history is preserved by default unless the
  user opts out.

## 7. Review responses (Task 30) and reconciliation (Task 32)

A response package (`format: "datanova-review-response"`, schemaVersion 1)
references `responseTo: { packageId, digest, schemaVersion }` — the digest
bind. Importing a response against a changed package fails safely
("digest does not match — the package changed after review"). The author's
reconciliation (`reconcileResponse`) diffs the reviewed version against the
current work and surfaces conflicts (annotated element changed locally)
with explicit resolution options (preserve-local / accept-incoming /
reject) — never a silent overwrite.

## 8. Replay (Tasks 38/39)

A package containing a scenario can be replayed by the recipient:
`replayDepScenario` parses the packaged model, runs the packaged scenario
against it (deterministic), and compares expectation outcomes with the
exported results. Identical package ⇒ identical replay (tested). Honest
blocked states, never invented results: no scenario, model version
mismatch, incompatibility, or model validation failure each produce an
explicit `blocked` reason.

## 9. Versioning and migration (Task 37)

- Supported import range: **[1, 1]** (current). v1 needs no migration;
  migration paths for future versions chain explicitly in `migrateDep`
  (which throws "no migration path" for unsupported versions — tested).
- Future major changes bump `schemaVersion` and add an explicit migration
  step preserving original metadata; older supported versions always
  import predictably, unsupported ones fail safely.

## 10. Example packages

See the test fixtures: `c05-exchange.test.ts` builds a full valid package
(round-trip tested), a package without optional data, tampered variants,
oversized/malformed/prototype-polluted/future-version inputs (all
rejected), and replay-blocked variants (no scenario, wrong model version).
