# Architecture Genome (Campaign 03, Task 06)

**Implementation:** `apps/web/src/lab/engines/genome.ts`; tests in `__tests__/m2.test.ts`.

A compact fingerprint of the design properties that determine BEHAVIOR,
extracted from the canonical model (never hand-entered):

| Trait | Derived from |
|---|---|
| syncDepth | longest chain of synchronous connections (cycle-safe) |
| statefulStores / queues / caches / externalDeps | component kinds |
| retryCoverage | `config.retryMax` over services+workers |
| isolationScore | `failureBehavior=isolated` fraction of connections |
| redundantComponents | `config.replicas >= 2` |
| idempotencyCoverage | `config.idempotent` over mutating services |
| asyncEdges / eventEdges / operations | connection kinds, operation count |

- **Fingerprint:** FNV-1a over the sorted, canonicalized trait list — stable
  across component reordering (semantically equal architectures produce equal
  fingerprints; verified by test).
- **Comparison:** `compareGenomes` reports trait deltas with a plain-language
  interpretation ("queues decouple producers from consumers at the cost of
  eventual completion").
- Used by: counterfactual attribution (T08), mutation effects, scorecard
  reliability dimension, benchmark fingerprints.

**Honesty:** traits are derived from DECLARED model properties (config, kinds,
edges). They describe the design, not measured runtime behavior.
