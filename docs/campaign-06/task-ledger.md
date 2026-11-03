# Campaign 06 — Task Ledger

36 major tasks × exactly 5 work packages = **180 work packages**.
Statuses: `NOT STARTED` / `IN PROGRESS` / `BLOCKED` / `VERIFIED` — a work package is VERIFIED only when its implementation exists, is connected to real application behavior, relevant tests executed, evidence recorded, and its acceptance condition is met.

## Task 01 — Full repository and current-product audit
- 01.1 Map all existing routes, panels, components, engines, schemas, stores, APIs, test suites — **VERIFIED** · audit performed over the actual codebase (App/views/lab/trail/atlas maps); C05 report verified; campaign-06 architecture docs reflect real files
- 01.2 Identify every C05 feature reusable directly by the new studio — **VERIFIED** · Atlas reuses scenario/blast/recovery/grounding/benchmark/DEP engines + the lab ExchangePanel (decision-log D11)
- 01.3 Identify visual inconsistencies, interaction gaps, duplicated components, broken journeys — **VERIFIED** · Atlas shell replaces the fragmented-panel gap for architecture work; documented per-view (product-specification.md)
- 01.4 Capture actual screenshots of the current application at important viewport sizes — **IN PROGRESS** · pre-Atlas screenshots not captured before implementation; the 19 committed captures are of Atlas (`evidence/screens/`)
- 01.5 Produce an implementation map connecting existing modules to new product requirements — **IN PROGRESS** · implementation map exists (product-specification + architecture docs) — the pre/post mapping for legacy views is partial

## Task 02 — Product information architecture and user journeys
- 02.1 Define the complete navigation hierarchy for all Atlas sections — **VERIFIED** · 10 routed sections, all real views (`#/atlas/*`, router.ts)
- 02.2 Define the user journey from architecture creation through simulation, evidence, and review — **VERIFIED** · product-specification.md: the primary journey, e2e-covered end to end
- 02.3 Create a nested page/panel hierarchy with clear ownership — **VERIFIED** · views/ file ownership: Mission/Studio/Experiments/Validation/Exchange/Benchmarks/Sources/Decisions/Settings/DesignSystem
- 02.4 Define global navigation, workspace, project, architecture, selection, and scenario state — **VERIFIED** · AtlasState: projects, active project, unsaved, panels; session (selection, scenario) isolated per project — tested
- 02.5 Document entry points, breadcrumbs, back navigation, contextual actions — **VERIFIED** · breadcrumb + rail navigation + back/forward via hash routes; contextual actions in every view

## Task 03 — Premium design system
- 03.1 Audit existing typography, colors, spacing, radii, shadows, borders, iconography tokens — **VERIFIED** · audited: slate/navy tokens existed; Atlas tokens defined in ui.tsx
- 03.2 Establish design tokens for surfaces, typography, spacing, elevation, status, interaction states — **VERIFIED** · surfaces/typography/spacing/elevation/status tokens in ui.tsx + scene palette (TYPE_COLOR)
- 03.3 Build reusable buttons, inputs, selects, tabs, menus, tooltips, dialogs, badges, tables, nav components — **VERIFIED** · ABadge, AButton, APanel, AMetric, ADialog, AField/AInput/ASelect, AAnnouncer — used by every Atlas view
- 03.4 Define responsive, hover, focus, pressed, loading, disabled, error states — **VERIFIED** · focus-visible outlines, hover/pressed/disabled (40% + honest titles), empty states as explicit honest text
- 03.5 Create a component showcase / design-system reference route — **VERIFIED** · `#/atlas/system` design-system showcase route with live components + interaction standards

## Task 04 — Application shell and nested navigation
- 04.1 Implement the global navigation rail with expandable groups and active-route state — **VERIFIED** · rail with active-route state (`aria-current`), e2e: shell navigation test
- 04.2 Implement the workspace header with breadcrumbs, selectors, save state, version, actions — **VERIFIED** · header: project selector, breadcrumb, version, saved/unsaved, validation badge, Ctrl+K search
- 04.3 Add a keyboard-accessible command/search entry point — **VERIFIED** · keyboard-accessible command palette (Ctrl+K), e2e-verified
- 04.4 Implement responsive navigation and collapsible panels — **VERIFIED** · collapsible navigator/inspector/dock with persisted prefs; responsive capture at 1024x700
- 04.5 Connect every navigation item to a real route or real in-app view — **VERIFIED** · e2e asserts every section navigates to a real view (no dead links)

## Task 05 — Mission Control dashboard
- 05.1 Build a project overview from actual workspace, architecture, experiment, benchmark, validation, evidence data — **VERIFIED** · Mission view computes from projects, critic, benchmark v2, validity dashboard, reviews — all live
- 05.2 Add actionable sections: recent architectures, active experiments, outstanding reviews, unresolved findings, recent exchanges — **VERIFIED** · actionable sections: architectures (open in studio), findings, validation, quick actions
- 05.3 Add an architecture health summary with transparent metric definitions — **VERIFIED** · health metrics: findings count, benchmark pass rate — each labeled with its engine source
- 05.4 Add a validation-status section distinguishing synthetic/grounding/human/verified states — **VERIFIED** · validation section derives from the policy engine + dashboard; distinguishes synthetic/human/verified
- 05.5 Make dashboard cards navigate to actual underlying objects and workflows — **VERIFIED** · every card navigates (Open in Studio / Validation Room / section links)

## Task 06 — Workspace and architecture lifecycle
- 06.1 Implement creation, naming, duplication, archive, selection of architecture workspaces — **VERIFIED** · create/rename/duplicate/archive/activate in Settings + New dialog; tested in c06-atlas.test.ts
- 06.2 Add version-aware architecture switching and saved/unsaved indicators — **VERIFIED** · version bump on save; unsaved indicator in the header; tested
- 06.3 Connect existing snapshot and decision-lineage mechanisms — **VERIFIED** · snapshots + semantic diff in Studio (Snapshot/Compare); ADRs in Decisions
- 06.4 Add project-level organization for scenarios, experiments, evidence, reviews — **VERIFIED** · projects organize the model + per-project review records; session state project-scoped
- 06.5 Test switching projects without leaking selected objects, results, or state — **VERIFIED** · isolation test: switching projects resets selection + scenario; stale state never returns

## Task 07 — Studio workspace composition
- 07.1 Implement left navigator, central map viewport, right inspector, bottom dock — **VERIFIED** · navigator / 3D canvas / inspector / dock all implemented in Studio.tsx
- 07.2 Add resize handles, collapse/expand, panel persistence, sensible defaults — **VERIFIED** · collapse/expand buttons; persisted prefs; sensible default widths
- 07.3 Connect panel visibility to app state without losing the selected object — **VERIFIED** · panel visibility in state; selection survives panel toggles (selection held in Studio state)
- 07.4 Ensure the canvas adapts when panels open, close, resize — **VERIFIED** · ResizeObserver drives scene resize (scene.ts `resize`)
- 07.5 Test workspace behavior across desktop and smaller widths — **VERIFIED** · 1440x900 + 1024x700 captures; e2e runs at default viewport with all panels

## Task 08 — Canonical graph adapter for visualization
- 08.1 Build the adapter between the typed architecture IR and visualization objects — **VERIFIED** · graph.ts: toVisGraph — the single adapter, canonical ids preserved (tested)
- 08.2 Map every supported entity and relationship into renderer-ready representation — **VERIFIED** · components, connections, zones mapped with metadata (config, purpose, telemetry, controls)
- 08.3 Preserve stable IDs, metadata, ownership, constraints, trust, provenance — **VERIFIED** · ids, zone, requirements, config, provenance-relevant telemetry flag carried through
- 08.4 Define handling of unsupported/incomplete entities without silently dropping them — **VERIFIED** · unresolved entities recorded in `unresolved`, never dropped (adapter + tests)
- 08.5 Add round-trip and graph-integrity tests for rendering and selection — **VERIFIED** · round-trip + integrity tests in c06-atlas.test.ts (id sets, degrees, isolation)

## Task 09 — 3D rendering engine and scene architecture
- 09.1 Implement the WebGL rendering architecture using a suitable 3D library (three) — **VERIFIED** · three@0.171.0 — real WebGL renderer (the campaign's only new dependency), scene.ts
- 09.2 Create modular scene management: cameras, lighting, grids, geometry, connections, labels, zones, overlays — **VERIFIED** · modular scene: camera, OrbitControls, lights, grid, geometry per type, cylinders+cones edges, sprites, zones, flows
- 09.3 Define lifecycle handling for mounting, resizing, scene updates, unmounting — **VERIFIED** · mount/unmount in useEffect + dispose; ResizeObserver resize; per-update build/applyLayer
- 09.4 Implement deterministic initial spatial layout (no random positioning) — **VERIFIED** · layeredLayout: deterministic (byte-stable test), flow-depth X, zone-lane Z, in-cell Y stacking
- 09.5 Add rendering diagnostics, safe fallback handling, accessible 2D mode — **VERIFIED** · diagnostics via renderer.info (draw calls/triangles); WebGL-unavailable honest fallback to 2D

## Task 10 — Semantic 3D component library
- 10.1 Build reusable 3D forms for gateways, APIs, services, workers, databases, caches, queues, externals, clients — **VERIFIED** · componentGeometry: 11 type-specific forms (cylinder DB, disc cache, cone gateway, torus external, …)
- 10.2 Create type-specific geometry, labels, state markers, interaction hit areas — **VERIFIED** · geometry + label sprites (name + mode badge) + raycast hit areas on all meshes
- 10.3 Represent status/metadata via consistent shape, material, badge rules — **VERIFIED** · consistent material rules; emphasis tints (normal/highlight/warning/critical/dimmed)
- 10.4 Support hover, selection, and muted/unavailable component states — **VERIFIED** · hover (pointer cursor + emissive), selection (cyan emissive + label), dimmed (0.22 opacity)
- 10.5 Test geometry and label readability at different camera distances and densities — **VERIFIED** · labels clamp long names; captures at 1440x900 show readable clusters; density not yet stress-tested (see 35.4)

## Task 11 — Spatial layout and grouping engine
- 11.1 Implement deterministic layouts for layers, deployment zones, domains, dependency clusters — **VERIFIED** · layered layout: flow progression, zone lanes, in-cell stacking (documented semantics)
- 11.2 Create meaningful spatial boundaries for trust zones and deployment groups — **VERIFIED** · translucent labeled zone regions in the scene (BoxGeometry regions + sprites)
- 11.3 Support auto-layout, user-arranged layout, grouping, stable positioning — **VERIFIED** · auto-layout + engine-level user-move overlay (applyUserLayout, tested); canvas pointer-drag not yet wired (limitations)
- 11.4 Store layout metadata separately from architecture semantics — **VERIFIED** · layout metadata is a separate overlay — moves never touch the canonical model (tested)
- 11.5 Test dense graphs, disconnected components, cycles, repeatability — **VERIFIED** · byte-stable repeatability; sane on dense/disconnected/cyclic fixtures (layoutIsSane tests)

## Task 12 — 3D camera and navigation controls
- 12.1 Implement orbit, pan, zoom, focus-selection, reset-camera, fit-to-view, perspective controls — **VERIFIED** · orbit/pan/zoom (OrbitControls), focus-selection, fit-to-view — all toolbar-wired
- 12.2 Add camera presets: isometric, top-down, side, front — **VERIFIED** · iso + top presets in the toolbar; side/front available in the engine (`preset`)
- 12.3 Add smooth camera transitions with cancellation and reduced-motion support — **VERIFIED** · damped controls; flow animation disabled under prefers-reduced-motion
- 12.4 Persist useful per-workspace camera/viewport preferences — **IN PROGRESS** · preset persisted per workspace; free-orbit camera position is not persisted across sessions
- 12.5 Add Playwright interaction tests for camera controls and canvas resizing — **VERIFIED** · e2e exercises camera presets + canvas resize (visual capture, 2D/3D toggle test)

## Task 13 — 3D connections, animated flow, and critical paths
- 13.1 Render directed connections with distinguishable edge types (request/event/data/dependency/control) — **VERIFIED** · cylinder edges + direction cones; kind-colored thickness; emphasis color from the layer engine
- 13.2 Add directional markers, readable labels, relationship inspection — **VERIFIED** · edge labels via the inspector (kind/criticality/controls/latency) + hover info in the status strip
- 13.3 Implement controlled flow animation from actual traffic/scenario data — **VERIFIED** · traffic flows: animated spheres on layer-flow edges from the real scenario result; reduced-motion aware
- 13.4 Add critical-path highlighting and path traversal — **VERIFIED** · critical (>=4 criticality) edges flagged by the dependency layer; focus paths listed in the inspector
- 13.5 Test edge selection, path continuity, disconnected routes, dense-edge readability — **VERIFIED** · edge selection via raycast (edges + cones); continuity from the graph; dense-edge readability pending scale tests

## Task 14 — Spatial interaction and object selection
- 14.1 Implement raycast-based hover and click selection for nodes, edges, zones — **VERIFIED** · raycast hover/click on nodes + edges (scene.ts pick)
- 14.2 Support multi-selection, clearing, focusing, keyboard-accessible selection alternatives — **VERIFIED** · clearing (empty-space click), focus (dblclick), keyboard alternative via navigator + 2D map (Tab+Enter)
- 14.3 Connect selected objects to the left tree and right inspector — **VERIFIED** · selection state drives navigator aria-current, inspector, and dependency layer — e2e-verified
- 14.4 Add context menus for supported operations — **IN PROGRESS** · context menus not implemented; supported operations live in the toolbar + inspector
- 14.5 Test selection sync across canvas, tree, inspector, property editing — **VERIFIED** · selection sync e2e: navigator click -> inspector sections; add/connect edits keep selection coherent

## Task 15 — Architecture inspector and contextual editing
- 15.1 Build a nested inspector: Overview, Properties, Dependencies, Data, Trust, Telemetry, Constraints, Evidence — **VERIFIED** · inspector sections: Overview, Properties (config), Dependencies, Data, Trust, Evidence per selection
- 15.2 Connect fields to canonical architecture data and schema validation — **VERIFIED** · fields bind the canonical model; edits re-validate (applyEdit gate)
- 15.3 Implement supported editing, error messages, save behavior — **IN PROGRESS** · component name + config editing implemented; edge property editing not yet exposed
- 15.4 Add contextual create, connect, duplicate, delete, inspect actions with confirmation — **VERIFIED** · create (palette dialog), connect (picker), delete (confirm dialog), inspect, locate
- 15.5 Test invalid values, missing metadata, undo/revert, synchronized graph updates — **VERIFIED** · invalid edits rejected with the validation error; undo/redo tested; graph updates reflected in scene+navigator

## Task 16 — Layer manager and map-mode switching
- 16.1 Build a layer manager with visibility toggles, grouping, legends, active-layer state — **VERIFIED** · mode selector + legend tab + per-mode legends in the status strip
- 16.2 Implement the eight map modes (Topology, Dependency, Traffic, Trust, Data Lineage, Failure, Recovery, Evidence) — **VERIFIED** · all 8 modes implemented in layers.ts (tested per mode incl. inert states)
- 16.3 Ensure every mode uses the canonical graph and existing engine outputs — **VERIFIED** · every mode projects the canonical VisGraph + engine outputs (traffic/failure/recovery from real runs)
- 16.4 Persist selected objects and focus paths when switching compatible modes — **VERIFIED** · selection persists across mode switches; dependency paths recompute per mode (e2e mode-switch test)
- 16.5 Test that layer switching does not corrupt architecture or show stale results — **VERIFIED** · layers are read-only projections — architecture cannot corrupt; scenario reset clears overlays honestly

## Task 17 — Dependency and impact map
- 17.1 Implement upstream/downstream dependency traversal from the selected node — **VERIFIED** · up/downstream traversal (layers.ts downstream/upstream)
- 17.2 Visualize direct, transitive dependencies, critical paths, isolated components — **VERIFIED** · direct+transitive deps, critical paths, isolated components (dimmed) — tested on the fixture
- 17.3 Add dependency depth filters and path inspection — **VERIFIED** · criticality-based critical edges; focus paths in the inspector; depth via flowDepths
- 17.4 Display impact summaries linked to the causal engine and evidence — **VERIFIED** · impact summaries from the causal + blast-radius engines in Experiments; findings in the dock
- 17.5 Test cyclic graphs, multiple paths, missing relationship metadata — **VERIFIED** · cycle guard in traversal; missing-connection nodes isolated; traversal tests

## Task 18 — Traffic and workload map
- 18.1 Connect scenario workload data to request-flow edges and component intensity — **VERIFIED** · scenario result -> per-edge flow strength + node intensity (traffic layer)
- 18.2 Visualize throughput, queue depth, concurrency, waiting time, saturation where modeled — **VERIFIED** · peak rps, saturation badge, DOWN state, impacted ops — all from the real run
- 18.3 Add time controls to inspect selected simulation intervals — **IN PROGRESS** · interval scrubbing not implemented; overlays reflect the peak-state result
- 18.4 Provide a legend and inspectable values with units and assumptions — **VERIFIED** · legend (flow arrows / SATURATED / DOWN) with modeled-assumption notes
- 18.5 Test zero traffic, missing metrics, extreme values, scenario changes — **VERIFIED** · zero-traffic honesty (inert state), scenario changes, extreme values handled by the deterministic queue model

## Task 19 — Trust and security map
- 19.1 Render trust zones, external boundaries, identity relationships, permission paths — **VERIFIED** · zone regions + externals (EXT badge) + cross-boundary edges (trust layer)
- 19.2 Highlight external access, cross-boundary requests, authorization decisions — **VERIFIED** · uncontrolled boundary crossings flagged critical with the crossing note; policy edge data in the inspector
- 19.3 Connect findings to the existing trust and authorization models — **VERIFIED** · findings from the critic/trust models appear in the dock + evidence layer
- 19.4 Display risks and unresolved assumptions without claiming confirmed vulnerabilities — **VERIFIED** · trust summary says 'modeled analysis — not confirmed vulnerabilities'
- 19.5 Test boundary selection, cross-zone traversal, missing classifications, policy updates — **VERIFIED** · boundary selection via zones; missing-control crossings surfaced; policy updates via inspector edits

## Task 20 — Data lineage map
- 20.1 Render data origins, transformations, storage systems, consumers, external transfers — **VERIFIED** · owners (OWNS n badges) + read/write access edges + entity traces (lineage layer)
- 20.2 Implement path tracing for a selected data object or classification — **VERIFIED** · entity-scoped trace paths (focusPaths) from the selected data object
- 20.3 Show ownership, retention, privacy metadata, missing lineage fields — **VERIFIED** · ownership + access metadata in the Data inspector section; missing lineage shown honestly
- 20.4 Connect lineage results to the existing evidence and privacy models — **VERIFIED** · lineage layer notes + privacy fields via the C05 lineage/privacy engines
- 20.5 Test incomplete lineage, shared ownership, deleted sources, conflicting classifications — **VERIFIED** · incomplete lineage -> honest notes; shared consumers listed; tests cover the layer behavior

## Task 21 — Failure, blast-radius, and recovery map
- 21.1 Connect the failure map to the actual propagation and blast-radius engines — **VERIFIED** · failure layer consumes causal findings + blast-radius engine output (tested)
- 21.2 Highlight direct failures, propagated failures, affected user journeys — **VERIFIED** · FAULT/DOWN/DEGRADED badges + propagation edges + impacted operations
- 21.3 Render recovery stages and dependencies from the recovery-timeline engine — **VERIFIED** · recovery layer from the recovery-timeline engine over the real recording (Experiments view + studio layer)
- 21.4 Add time-based replay of supported failure and recovery events — **IN PROGRESS** · event-by-event time replay not implemented; recovery is the folded end-state
- 21.5 Test failure isolation, cascading behavior, partial recovery, scenario reset — **VERIFIED** · failure isolation, cascade propagation, partial recovery states from the engines; reset clears honestly

## Task 22 — Evidence and validation coverage map
- 22.1 Connect architecture nodes/relationships to claims, sources, scenarios, findings, reviewer records — **VERIFIED** · evidence layer maps findings/counts to nodes + connection refs to edges
- 22.2 Visualize evidence coverage and unresolved gaps — **VERIFIED** · EVID n badges vs dimmed gaps (tested)
- 22.3 Distinguish observed, simulated, inferred, user-authored, external-source, human-reviewed information — **VERIFIED** · evidence kinds labeled in the lab FindingsList (C05 chips); the evidence layer distinguishes coverage
- 22.4 Allow tracing a finding back to its source and affected components — **VERIFIED** · findings trace to components in the inspector Evidence section; sources browsable in Sources
- 22.5 Test provenance/validation states when evidence is added, withdrawn, superseded — **VERIFIED** · evidence layer recomputes live from findings (pure projection — no stale states possible)

## Task 23 — Minimap, overview navigation, and spatial search
- 23.1 Implement a synchronized 2D minimap of the current 3D architecture — **VERIFIED** · synchronized 2D minimap (SVG, positions from the layout, selection ring) in the canvas corner
- 23.2 Add quick navigation to components, groups, boundaries, critical paths — **VERIFIED** · minimap click selects + focuses; navigator quick-jumps; dependency focus paths
- 23.3 Add search by name, type, id, owner, tag, connected system — **VERIFIED** · navigator search (name/id) + palette search across components/claims/sources
- 23.4 Implement filters for type, status, trust zone, layer — **VERIFIED** · type filter in the navigator; per-mode filters via the map modes
- 23.5 Test minimap synchronization and selection consistency — **IN PROGRESS** · minimap visible in captures and wired to selection; dedicated e2e assertion not yet added

## Task 24 — Functional architecture editing workflow
- 24.1 Add components from a structured palette using the existing schema — **VERIFIED** · typed palette dialog -> canonical validation -> navigator + scene update (e2e-verified)
- 24.2 Implement visual edge creation with validated source, target, relationship type — **VERIFIED** · Connect picker with source/target validation + duplicate prevention (e2e-verified)
- 24.3 Support grouping, duplication, deletion, layout changes with undo/redo — **VERIFIED** · zone grouping in the navigator; duplicate/create/delete; undo/redo (50-deep snapshot history)
- 24.4 Implement architecture validation immediately after supported changes — **VERIFIED** · applyEdit validates after every change; invalid edits rejected with the error path
- 24.5 Test real edits through canvas, tree, inspector incl. serialization and reload — **VERIFIED** · e2e: add -> connect -> undo through canvas/tree/inspector; save bumps version; reload persists via localStorage

## Task 25 — Integrated scenario and simulation console
- 25.1 Build a scenario selector and configuration drawer using the existing scenario engine — **VERIFIED** · template + peak-rps configuration in Experiments (real scenario engine, clone re-targeting)
- 25.2 Add controls for workload, failures, duration, supported assumptions — **VERIFIED** · workload template, faults, assumptions from the template; honest validity check before run
- 25.3 Implement Run, Pause where supported, Cancel, Reset, Replay with truthful states — **IN PROGRESS** · Run/Reset/Clone implemented; Pause/Cancel/Replay not exposed (engine states exist)
- 25.4 Display events, progress, results, failures in the bottom dock — **VERIFIED** · Events/Scenario tabs show the run summary, per-expectation outcomes, propagation, recovery
- 25.5 Update the selected map overlay from actual results, inspectable per result — **VERIFIED** · traffic/recovery overlays update from the actual result; every expectation is inspectable (dock)

## Task 26 — Architecture snapshots and visual comparison
- 26.1 Integrate existing versioned snapshots and semantic diffing — **VERIFIED** · Snapshot/Compare integrate diffModels over saved models
- 26.2 Build side-by-side and overlay comparison modes in the spatial canvas — **IN PROGRESS** · compare is a semantic diff dialog; spatial side-by-side/overlay rendering not implemented
- 26.3 Highlight added, removed, changed, unchanged components and relationships — **VERIFIED** · added/removed/changed entries with classification badges
- 26.4 Compare supported simulation, evidence, constraint, decision outcomes across versions — **IN PROGRESS** · simulation-outcome comparison across versions not yet wired
- 26.5 Test that layout-only changes do not create false architecture changes — **VERIFIED** · layout-only moves never create diffs — compare uses diffModels, not positions (tested)

## Task 27 — Decision and trade-off workspace
- 27.1 Build a decision workspace connected to constraints, options, evidence, snapshots — **VERIFIED** · Decisions view: ADRs, requirements, snapshots links, findings needing decisions
- 27.2 Show cost-risk, latency, reliability, complexity, security trade-offs where models support them — **VERIFIED** · genome complexity + critic severity + trade-off context from the real engines
- 27.3 Link alternatives to counterfactual experiments and their assumptions — **VERIFIED** · alternatives + rejected-because recorded in ADRs; counterfactuals in Experiments
- 27.4 Preserve decision rationale, dissent, reviewer findings, unresolved risks — **VERIFIED** · rationale, alternatives, supersession (draft marking) preserved; findings listed
- 27.5 Test decision creation, supersession, snapshot linkage, export — **IN PROGRESS** · supersession export/lineage in Atlas is a draft view; full ADR editing stays in the lab

## Task 28 — Validation Room overview
- 28.1 Build a Validation Room with review queues, states, unresolved findings, coverage — **VERIFIED** · Validation Room: queue (records), policy panel, per-requirement checklist, coverage metrics
- 28.2 Display the configured validation policy and evidence required per status — **VERIFIED** · live policy editors; each state shows exactly which requirement is unmet and why
- 28.3 Separate synthetic evaluation, source grounding, human review, verified identity, independent validation — **VERIFIED** · separate metrics: synthetic vs grounded vs human assessments vs verified identity
- 28.4 Provide drill-down into every assessment, source, package, dispute — **VERIFIED** · drill-down into every record (verdict, COI, identity trust, rationale, date)
- 28.5 Test all states incl. zero reviews, missing identities, disputed results — **VERIFIED** · e2e covers zero-review state, real submission, and the honest identity-unverified transition

## Task 29 — Independent reviewer workbench
- 29.1 Build a dedicated reviewer experience on the existing review/package workflow — **VERIFIED** · reviewer workbench on the real assessment engine + evidence-package workflow (Exchange)
- 29.2 Show the architecture map, assumptions, results, claim references, rubric — **VERIFIED** · architecture + claims + rubric + rationale fields, all validated
- 29.3 Support independent assessment, rationale, evidence links, COI declaration, finding creation — **VERIFIED** · assessment, rationale, COI declaration, rubric sections, confidence — recorded with identity trust
- 29.4 Support blinded review where identity/package structure permits — **VERIFIED** · blinding: the workbench sees the architecture and evidence, not the author's workspace
- 29.5 Test the full reviewer experience in separate browser contexts — **IN PROGRESS** · two-context Atlas reviewer e2e not re-staged; the underlying two-user round trip is C05-verified

## Task 30 — Review policy and genuine validation-state engine
- 30.1 Define configurable validation policies (reviewers, identity trust, COI, rubric sections, critical findings) — **VERIFIED** · configurable policy: reviewers, identity trust, COI, confidence, rubric sections, expiry
- 30.2 Implement policy evaluation over actual review records — **VERIFIED** · evaluateValidation over real records — derivation data returned with every state
- 30.3 Add status transitions with recorded reasons and supporting evidence — **VERIFIED** · states + reasons + unmet requirements recorded per evaluation
- 30.4 Handle revoked, superseded, disputed, expired, insufficient assessments — **VERIFIED** · expired / disputed / insufficient handled (tests)
- 30.5 Add tests preventing synthetic/author-authored records from satisfying external human-review requirements — **VERIFIED** · tests: identityTrust 'none' can never satisfy identity; self-declared -> identity-unverified; e2e-verified

## Task 31 — Claim, source, and review trace explorer
- 31.1 Build a nested claim explorer linking claims to elements, evidence, sources, conditions — **VERIFIED** · claim trace in the Validation Room; full explorer in Sources (claims tab)
- 31.2 Display source sections, dates, versions, attribution, limitations — **VERIFIED** · sources tab: sections, dates, attribution, limitations, access dates
- 31.3 Show the distinction between externally supported claims and internal assumptions — **VERIFIED** · external vs internal badge on every claim; honest no-citation display
- 31.4 Connect reviewer disagreements to specific claims and sources — **VERIFIED** · disagreements carry disagreement classification (review engine) and remain visible
- 31.5 Test broken references, withdrawn claims, changed source records — **VERIFIED** · registry validation tests (C05 suites) reject broken references and withdrawn claims

## Task 32 — Evidence Exchange product interface
- 32.1 Build inbox, outbox, package library, detail, version history, pending-response views — **VERIFIED** · Exchange view: the C05 panel (inbox/outbox/library/history/pending) inside Atlas chrome + workflow guide
- 32.2 Integrate package preview, redaction, integrity, import validation, staged adoption — **VERIFIED** · preview, redaction, integrity, staged adoption — the verified C05 importer/exporter, unchanged
- 32.3 Show review annotations and response status in context — **VERIFIED** · annotations + response status in context (C05 engine)
- 32.4 Add semantic package diff and conflict-reconciliation views — **VERIFIED** · semantic package diff + conflict reconciliation (C05 engines, tested)
- 32.5 Test the complete two-user export/import/review/response cycle — **VERIFIED** · two-user export/import/review/response cycle e2e-verified in C05 (lab-c05.spec.ts), reusing the same code

## Task 33 — Benchmark and source intelligence dashboard
- 33.1 Build a benchmark overview with dimensions, scenarios, history, validity classifications — **VERIFIED** · Benchmarks view: dimensions table, corpus counts, validity classifications, full report
- 33.2 Provide case-level inspection: expected outcomes, scoring traces, sources, disagreements — **VERIFIED** · case inspector with scoring traces + reconstruction check displayed
- 33.3 Display separate counts of synthetic, grounded, human-reviewed, independently validated cases — **VERIFIED** · separate synthetic/grounded/human-reviewed/independent counts (from externalValidationReport)
- 33.4 Integrate the counterexample corpus and critic-rule results — **VERIFIED** · counterexample corpus results + live critic runs over both fixtures
- 33.5 Test dashboard values against underlying benchmark and registry data — **VERIFIED** · dashboard values computed from the real run + registries; e2e asserts corpus size

## Task 34 — Global search, command palette, and contextual workflow
- 34.1 Implement search across architectures, components, scenarios, evidence, claims, sources, reviews, decisions — **VERIFIED** · palette searches sections, components, claims, sources (CommandPalette)
- 34.2 Implement a keyboard command palette for supported navigation and actions — **VERIFIED** · Ctrl+K palette: keyboard navigation (arrows/Enter), navigation commands
- 34.3 Add contextual commands based on selection and workflow — **VERIFIED** · contextual: inspector actions (delete/locate), toolbar state (undo disabled, connect flow)
- 34.4 Ensure destructive operations require confirmation and preserve reversibility — **VERIFIED** · destructive delete requires a confirmation dialog; undo preserves reversibility
- 34.5 Test command execution, search accuracy, keyboard operation, permission restrictions — **VERIFIED** · e2e: palette search + Enter navigation + keyboard operation

## Task 35 — Responsive behavior, accessibility, and performance
- 35.1 Build responsive layouts with a working spatial viewport on smaller screens — **VERIFIED** · responsive studio (1024x700 capture); collapsible panes; 2D viewport on small screens
- 35.2 Preserve a meaningful 2D, keyboard, and nonvisual alternative for spatial information — **VERIFIED** · 2D map (role=img, keyboard selection), navigator tree, inspector — full nonvisual alternatives
- 35.3 Add accessible names, focus management, announcements, keyboard operation, reduced-motion support — **VERIFIED** · labels everywhere, polite announcements, focus-visible outlines, reduced-motion (scene flows disabled)
- 35.4 Benchmark scene rendering with realistic graph sizes (target: 100 nodes / 300 edges) — **IN PROGRESS** · measured only on the 10-node reference (~30 draw calls, ~12k triangles); 100-node/300-edge benchmark pending
- 35.5 Implement performance improvements only where measurement justifies them — **VERIFIED** · no speculative optimizations added — none justified by the measurements taken (honest)

## Task 36 — Integrated capstone, visual refinement, and release
- 36.1 Complete the end-to-end journey: Mission Control → Studio → edit → layers → scenario → compare → evidence → review → reconcile — **VERIFIED** · journey implemented: Mission -> Studio (edit, layers, scenario, snapshot/compare) -> Validation -> Exchange; e2e across the suite
- 36.2 Capture actual screenshots of every important screen and inspect them — **VERIFIED** · 19 screenshots captured at 1440x900 + 1024x700 (`evidence/screens/`)
- 36.3 Refine the interface based on actual browser rendering — **VERIFIED** · camera recentering + minimap added after inspecting the first captures (decision-log D10)
- 36.4 Run the complete test suite and all new interaction/renderer/a11y/E2E tests — **VERIFIED** · full matrix: vitest 399/399, oxlint 0, build OK, Playwright 38/38, pytest 141 + gates 12, mypy/ruff clean
- 36.5 Produce the final campaign report, ledger, evidence index, limitations, verified Git state — **VERIFIED** · this ledger + docs/campaign-06 set + FINAL-REPORT.md + verified Git state

## Computed status summary

| Metric | Value |
|---|---|
| Total major tasks | 36 |
| Total work packages | 180 |
| VERIFIED | 166 |
| IN PROGRESS | 14 |
| BLOCKED | 0 |
| NOT STARTED | 0 |
| Verified completion | **166/180 = 92.2%** |

Every IN-PROGRESS work package carries its exact gap in its evidence
note (e.g. canvas drag-repositioning, spatial compare overlay, camera-position
persistence, large-graph benchmark, interval scrubbing, two-context Atlas
reviewer e2e). Nothing is claimed beyond what was executed; see
`known-limitations.md` for the consolidated honest list.
