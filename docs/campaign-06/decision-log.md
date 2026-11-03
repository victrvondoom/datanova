# Campaign 06 — Decision Log

## D01 — three.js as the only new dependency, added deliberately

The repo had no WebGL renderer. Campaign rule 3.3 explicitly permits
evaluating Three.js. `three@0.171.0` (+ types) was installed: genuine WebGL,
mature, modular, works headless (SwiftShader) for e2e. It is the campaign's
ONLY new runtime dependency (verified in package.json). Everything else is
pure TypeScript over the existing engines.

## D02 — Atlas as a new full-bleed view, not a rebuild

`#/atlas/...` mounts inside the existing app shell (same pattern as the
trail and lab) with its own rail/header. The C03–C05 products remain
untouched (all their suites re-run green); the Atlas reuses their engines
rather than duplicating them — the lab's ExchangePanel is mounted inside
the Atlas Exchange view rather than forked.

## D03 — one graph adapter, one layout engine, one layer engine

`graph.ts` (canonical IR → VisGraph, no dropped entities), `layout.ts`
(deterministic layered layout; user moves are a separate overlay),
`layers.ts` (all 8 modes as pure projections). The renderer only
interprets these results — no engine semantics live in three.js code.

## D04 — coordinate semantics fixed and documented

X = flow progression, Z = trust-zone lanes, Y = in-cell stacking. No
randomness: identical graphs produce identical layouts (test-enforced),
which is also what makes e2e screenshots stable.

## D05 — semantic 3D forms over color-only coding

Type-specific geometry (cylinder DB, flat-disc cache, cone gateway, torus
external, octahedron worker…) per task 10 — a rule consistent with the
repo-wide "never color alone" a11y convention. Labels are canvas-texture
sprites with deterministic content (name + mode badge).

## D06 — honest WebGL failure path

If WebGL cannot init, the scene reports `webglAvailable: false`, the status
strip says "WebGL unavailable — switch to 2D", and the 2D accessible map is
the real fallback (not a degraded 3D). In CI Chromium, SwiftShader renders
the real scene — the e2e asserts live diagnostics (draw calls, triangles).

## D07 — session state deliberately NOT persisted

Project switching resets selection + scenario state (tested) — the exact
isolation the campaign demanded. Panel prefs and projects persist; sessions
don't.

## D08 — undo/redo as model snapshots, save as version bump

Editing keeps a 50-deep snapshot history; Save re-validates the model and
bumps the project version with an unsaved indicator in the header until
saved. The e2e proves add → connect → undo round-trips through the
canonical model.

## D09 — validation states derive from a real policy engine

No badge decoration: `evaluateValidation` computes state from actual review
records under a configurable policy (reviewers, identity trust, COI,
confidence, rubric coverage, expiry). Records with `identityTrust: "none"`
can never satisfy identity requirements (test). The e2e proves the honest
`identity-unverified` state after a real submission.

## D10 — visual review performed on real captures

19 screenshots captured from the built app; inspection found the initial
camera framing pushed the scene left-of-center → `fitToView` adjusted and
captures regenerated. The minimap (task 23) was added to the canvas after
the first capture pass. All screenshots live in
`docs/campaign-06/evidence/screens/`.

## D11 — reuse over rebuild for exchange/benchmarks/sources

The Atlas views mount the verified C05 exchange panel, the C04 benchmark
engines, and the C05 registries directly — no copied logic, one canonical
source of truth per capability.
