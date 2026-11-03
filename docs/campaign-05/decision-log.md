# Campaign 05 — Decision Log

## D01 — Attack the three C04 gaps directly; everything else is support

The campaign brief names the three gaps (real AT verification, external
grounding, evidence exchange). Implementation order and effort allocation
followed them: Phase 1 a11y (baseline + platform-level UIA evidence +
live regions + tablist), Phase 2–4 grounding/validity (registries as code,
validated by tests), Phase 5–8 the DEP format and exchange workflow, Phase 9
the two-user capstone e2e. No C04 behavior was rebuilt.

## D02 — Registries are code, not prose

External sources, claims, and cases live in TypeScript modules
(`sources.ts`, `claims.ts`, `cases.ts`) with **executable validation**:
duplicate ids, non-https URLs, missing sections, dangling references, and
"external claim citing nothing" all fail tests. Consequence: the registry
can never silently rot, and the UI can cite it programmatically.

## D03 — Only real, verifiable, primary sources

19 registered sources, all primary (IETF RFCs, NIST, peer-reviewed
publications, official vendor engineering docs, one regulation). Each
records title/author/URL/date/access-date/topics/note/section/attribution/
limitations. The IETF idempotency draft is cited **with its draft status**.
Living documentation is dated by access (2026-11-03). No invented citations —
and the claim registry forbids "external" claims without sources.

## D04 — Honest claim taxonomy: external / assumption / simplification / heuristic

19 externally grounded claims cite sources; 5 internal claims
(complexity heuristic, queueing approximation, genome fingerprint, causal
rule magnitudes) are labeled internal and must state their `labDelta` when
they mention sources at all. The grounding layer (`grounding.ts`) maps
critic rules and engine families to claims and reports `insufficient`
when a finding has no claim — never inventing support.

## D05 — Benchmark validity is metadata, not opinion

Provenance is classified per case (`synthetic` / `externally-grounded` /
`externally-reviewed` / `independently-validated`), and the v2 corpus is
class-synthetic by test. The validity dashboard computes from actual
records and **distinguishes missing from failed validation**; "no reviews"
is displayed as `not-yet-validated` with a "trivially true" honesty note on
the disagreement dimension. No dashboard state can disguise unreviewed cases
as validated.

## D06 — NVDA: BLOCKED, not faked; UIA evidence instead

Environment audit: NVDA and JAWS are **not installed**; installing software
needs authorization the campaign lacks. Narrator is present but validating
announcements requires a human listener. So the campaign executed the next
best *real* thing: captured the app's **UI Automation tree** (the API
Windows screen readers consume) from a headed, accessibility-forced
Chromium — 89 named controls, tablist exposed as UIA Tab/TabItem
(`evidence/uia-intent-tab.txt`). This is classified as platform-tree
verification (AUTOMATED), explicitly NOT manual AT verification.

## D07 — A real a11y defect found by a real check

The new e2e unlabeled-control scan found the dashboard theme toggle had
only a `title`, no accessible name — fixed with `aria-label` and verified
at UIA level ("Switch to light theme"). The scan now passes with an empty
violation list, making it a durable regression gate rather than a one-off.

## D08 — ARIA tablist with roving focus

The lab tab bar became a real `role="tablist"` with `aria-selected`,
`tabIndex` roving, and ArrowLeft/ArrowRight navigation (focus follows). Hash
navigation is preserved underneath. This is the keyboard-model improvement
for T05, e2e-verified including focus assertions.

## D09 — Live regions: polite, status-scoped, change-triggered

`Announcer` (`role="status"`, `aria-live="polite"`) renders the latest
message only when it changes: intent compile results, package export
validation, import accept/reject, annotation add, response import. No
focus stealing (status role), no repetition of unchanged content, and e2e
asserts the announced text. Announcement copy is data-bearing (counts and
ids), not decorative.

## D10 — DEP integrity: checksums, never signatures

No signing library or key-management exists in the project. Decision: the
manifest uses fnv1a-32 content checksums labeled as **corruption
detection**, and author authenticity is **explicitly unsupported** — the
package spec, UI copy, and security review all say "a checksum is not a
signature". Introducing signing would need a real key-management decision
(user-managed keys), deferred and recorded.

## D11 — Import is a security boundary; adoption is staged

`validateDep` treats every package as untrusted: size/depth/count limits,
strict key allowlists, prototype-pollution scanning, manifest verification,
canonical-model re-validation, registry-resolved citations, and safe
future-version failure. The UI stages: validate → preview → receive →
inspect → accept/reject; the workspace changes only on explicit acceptance
(e2e-verified, including the rejection path).

## D12 — Digest-bound responses and conflict-aware reconciliation

Review responses bind to the reviewed package's content digest; a changed
package invalidates them safely. Reconciliation diffs the reviewed version
against the author's current work and surfaces conflicts with explicit
resolution options — never a silent overwrite. Provenance is append-only
and digest-linked; deletion preserves outbox attribution history by
default (GDPR-minimisation-informed, recorded as engineering
interpretation).

## D13 — Two-user capstone in e2e with real separate contexts

The exchange capstone uses two independent browser contexts (Architect A,
Reviewer B) through the actual UI: export → validate → receive → inspect →
accept → annotate → resolve → download response → author-side import →
provenance visible. Downloads are captured via Playwright's download API —
a genuine file-based exchange, not a state shortcut.
