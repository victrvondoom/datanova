# Campaign 05 — Security Review (Evidence Exchange)

Executable security posture of the package-exchange feature. Machine
evidence: `apps/web/src/lab/__tests__/c05-exchange.test.ts` (T24/T36 block),
e2e `e2e/lab-c05.spec.ts` ("tampered packages are rejected in isolation").

## 1. Threat model (Task 36)

**Asset:** the user's local architecture work (localStorage-backed lab
state) and its integrity; the user's privacy (author metadata, emails,
credential-like config).

**Trust boundaries:**

1. **Untrusted package → importer.** Any JSON pasted into the import box is
   attacker-controlled (foreign origin, unknown author, no transport
   security needed — it arrives by file/copy).
2. **Importer → workspace state.** Applied only on explicit staged
   acceptance; the boundary is the `validateDep` verdict.
3. **Response → author's workspace.** Digest-bound; changes to the package
   since review invalidate the response.

**Attack surfaces and mitigations:**

| Threat | Mitigation | Test |
|---|---|---|
| Prototype pollution (`__proto__`/`constructor`/`prototype` in JSON) | structural scan rejects such keys anywhere, before any use | hand-written malicious JSON fixture, rejected |
| Oversized payload / DoS | 512 KB hard cap, depth ≤ 16, count caps (200 evidence / 100 assumptions / 50 results), string length cap | oversized fixture rejected |
| Parser crash | JSON.parse isolated in try/catch; failures become clean verdicts | malformed-JSON fixtures (4) |
| Schema confusion / smuggling fields | strict allowlist of top-level + `createdBy` + `manifest` keys | unknown-key fixture rejected |
| Path traversal / unsafe manifest paths | paths must match `/^[\w.-]+\.json$/`; only six fixed virtual sections exist | manifest path check + fixed sections |
| Tampered content presented as valid | per-section fnv1a-32 checksums + byte lengths verified before preview | falsified-results fixture rejected with "checksum mismatch" |
| Fabricated citations | `sourceIds`/`claimIds` must resolve against the shipped registries | unknown-source fixture rejected |
| Corrupted embedded model | `parseModel` validation gate before preview | broken-model fixture rejected |
| Future/unknown schema versions | explicit version range check with safe failure + upgrade guidance | v99 fixture rejected safely |
| Code execution from package data | none: packages are plain data; nothing is `eval`'d, no code paths are imported; engines are pure functions of data | by construction + full suite |
| External actions during import | none: the exchange path performs no network I/O and no file writes except explicit user-initiated downloads | by construction |

## 2. Honest limits of the integrity model

- fnv1a-32 is a **corruption-detection checksum, not a signature**. It is
  trivially forgeable by a determined attacker who recomputes it. No
  signing library or key management exists in the project, so **author
  authenticity is explicitly unsupported** — package identity metadata is
  self-declared and labeled as such (a checksum is not verified authorship).
- The importer defends the workspace; it cannot verify a sender's real
  identity. Trust decisions are the recipient's (inspect → accept/reject).

## 3. Privacy posture

- Author email excluded by default; redactions recorded in the package.
- Sensitive-content scan (emails, credential-like keys) shown before export.
- Deletion of received data preserves outbox attribution history by default.
- No telemetry, no network calls, no analytics anywhere in the exchange path.

## 4. Unresolved risks (recorded)

1. A crafted package could still contain *valid-looking but false* claims
   (e.g., misleading evidence summaries). Integrity checks prove the bytes
   are what the manifest recorded — not that the content is true.
   Recipients should replay scenarios (§8 of the spec) and review sources.
2. localStorage persistence means a malicious script on the same origin
   could read exchange data; out of scope for a static SPA with no
   third-party scripts (Content-Security-Policy hardening is a candidate
   follow-up).
3. No signing: see §2. Introducing one would require a real key-management
   decision (user-managed keys), explicitly deferred.
