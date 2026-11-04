# Campaign 07 — Spatial Runtime Map Specification

## 1. 10 Operational Layers in Atlas 3D Studio & 2D Fallback

DataNova Atlas Studio is extended with 10 operational runtime layers. The user can toggle between them in the Studio HUD mode selector:

1. **Intended Topology (`mode-intended`):** Canonical architecture graph showing planned services, trust zones, and design dependencies.
2. **Configured Infrastructure (`mode-configured`):** Deployed infrastructure resources as declared in Kubernetes and Terraform manifests.
3. **Observed Runtime Topology (`mode-observed`):** Actual live service communication paths synthesized from distributed trace spans.
4. **Dependency Divergence (`mode-divergence`):** Visual diff highlighting undocumented edges in pulse-red and unobserved edges in dashed amber.
5. **Request Volume (`mode-volume`):** Traffic throughput mapped to edge cylinder thickness and particle flow speed.
6. **Latency (`mode-latency`):** Component and edge latency heatmaps (Green < 20ms, Yellow < 100ms, Orange < 500ms, Red >= 500ms).
7. **Error Rate (`mode-error-rate`):** Visual indication of HTTP 5xx or unhandled exceptions per service.
8. **Saturation (`mode-saturation`):** Queue depth and CPU/worker saturation indicators displayed over component mesh plates.
9. **Incident Impact (`mode-incident-impact`):** Root-cause focal glow and cascading blast-radius propagation paths.
10. **Data Quality & Evidence Coverage (`mode-coverage`):** Highlighting observed components vs telemetry blind spots.

---

## 2. Visual Encodings & Accessibility

- **Relationship Encodings:**
  - Intended edges: Solid blue/slate lines with forward cones.
  - Configured edges: Solid purple/violet lines.
  - Observed edges: Glowing emerald cylinders with animated particle flow.
  - Divergent/Undocumented edges: Pulsing crimson-rose cylinders with exclamation markers.
- **2D Accessible Fallback:**
  - Full SVG rendering maintaining the same 10 layer filters, high-contrast badges, keyboard focus rings, and screen-reader ARIA live regions.
