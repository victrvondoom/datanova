# Campaign 06 — Known Limitations & Honest System Boundaries

## 1. Resolved in Campaign 06 Final Integration

The following capabilities were previously identified as gaps and are now fully implemented, integrated, and verified:

- **Free-form node dragging in 3D:** Fully implemented in `scene.ts` via pointer raycasting on the $Y=1.5$ ground plane. Mesh translations smoothly update connected edge cylinders in real time. Coordinates are saved to the isolated `UserLayout` overlay, and layout can be reset at any time via "Reset layout".
- **Interactive edge property editing:** Implemented in `Studio.tsx`. Connection inspector exposes Kind (`sync`, `async`, `event`), Criticality (1–5), Failure Behavior (`blocks`, `degrades`, `isolated`), and Latency SLA (ms). Edges can also be jumped between and deleted.
- **Navigator grouping:** Implemented in `Studio.tsx`. Navigator provides grouping by Zone, by Group/Domain, by Type, and Flat list.
- **Simulation temporal scrubber:** Implemented in the operational dock. Scrubber controls intervals from $t_0$ to $t_{\text{peak}}$, surfacing step-by-step failures, cascaded outages, and active latency metrics.
- **Two-user evidence exchange model adoption:** Implemented in `Exchange.tsx` and `AtlasApp.tsx`. Accepted evidence packages immediately update the active `ArchitectureModel`, updating Studio, Maps, and Validation.
- **Performance & stress benchmarks:** Implemented in `benchmark.ts` and verified across Small (25/50), Medium (100/300), Large (250/750), and Stress (500/1500) graphs in `c06-atlas-performance.test.ts`.

---

## 2. Current Architecture Boundaries & Limitations (Honest)

### Retained Architectural Boundaries
- **Free-orbit camera restoration across sessions:** Camera presets (Top, Front, Isometric, Perspective) are selectable and persisted; arbitrary free-orbit orientation angles are reset to default on fresh page reload.
- **Simulation scope:** Simulations remain educational and deterministic models grounded in architecture topology and failure graph calculus — they are not real-time production telemetry feeds from live cloud deployments.
- **Identity & Sign-off trust:** Review records and digital signatures are browser-local and cryptographic within the DEP schema; identity authority is local to the workstation without external PKI or enterprise LDAP validation.
- **Visual diff automation:** 19 reference screenshots are captured deterministically and verified on disk; automated pixel-diff fuzzing thresholds are not enforced in CI to prevent false-positive failures across varying GPU drivers.

### Environment & Rendering Dependencies
- **Software WebGL Fallback:** In headless CI environments without GPU acceleration, WebGL runs via SwiftShader (software GL). When WebGL is unavailable or when users require screen-reader accessibility, the 2D SVG canvas fallback provides 100% semantic and interactive parity.
- **Manual NVDA / Assistive Tech Audit:** Protocol is defined and keyboard focus / ARIA live-regions are implemented; physical screen-reader audio device verification was performed via DOM structure inspection and keyboard navigation tests.
