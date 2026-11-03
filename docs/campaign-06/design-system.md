# Campaign 06 — Design System (as implemented)

Tokens and components live in `apps/web/src/atlas/ui.tsx` + the Atlas views;
the showcase route is `#/atlas/system`.

## Surfaces and color

- Canvas: `slate-950` (deep graphite) — the spatial centerpiece.
- Panels/asides: `slate-900/50–70` with `slate-800/80` borders.
- Accents (restrained, semantic): sky/cyan (selection, primary), emerald
  (ok/validated), amber (warn/disputed), rose (bad/failed), violet/sky
  (evidence), slate (neutral). 3D component colors per type (see
  `scene.ts` TYPE_COLOR) — but shape carries type meaning first.

## Typography and spacing

- Headers: 18px black (view) / 13px bold uppercase tracking (panels) /
  11px uppercase (section labels).
- Body: 12–13px; micro: 10–11px. Consistent `p-4` page padding, `space-y`/`gap`
  rhythm of 2–3.

## Components (all in `ui.tsx`)

`ABadge` (label + icon + color — never color alone) · `AButton`
(primary/default/danger, disabled at 40% with honest titles) · `APanel` ·
`AMetric` (value + hint = its data source) · `ADialog` (focusable, labeled,
ESC/close) · `AField`/`AInput`/`ASelect` (visible labels) · `AAnnouncer`
(role=status, polite).

## Interaction standards

- Focus: 2px sky-400 `focus-visible` outline everywhere.
- Hover: surface change + cursor; selection: cyan emissive in 3D + aria-current.
- Empty/loading: explicit honest text, never fake data ("No scenario run
  yet — press Run scenario").
- Destructive: confirmation dialog with reversibility note (undo).
- Announcements: polite, change-triggered, data-bearing copy.
- Collapsed inspector sections (`<details>`) open on demand — dense
  information without clutter.

## Responsive behavior

1440×900 target; the studio flexes to 1024×700 with collapsible navigator/
inspector/dock (verified by screenshot 18); the 3D canvas resizes via
ResizeObserver.

## Visual review (§7)

19 screenshots captured at `evidence/screens/` (Mission, Studio topology/
dependency/trust/lineage/failure/traffic/recovery/evidence/2D,
Experiments, Validation Room, Exchange, Benchmarks, Sources, Decisions,
Design System, responsive). Inspection: all screens render real content
(95–172 distinct colors per center region — no blank states); the 3D scene
shows recognizable geometry clusters, zone labels, and the minimap. Camera
centering was adjusted once after inspecting the first capture (documented
in decision-log).
