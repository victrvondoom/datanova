/**
 * Task 41 — Architecture Intelligence Benchmark Suite.
 *
 * A corpus of architectures with ground-truth annotations tests the REASONING
 * QUALITY of the analyzers: precision, recall, false positives/negatives,
 * and unsupported-claim rate. Metrics are computed from actual runs — never
 * invented — and the report records limitations and the delta against the
 * previous recorded run.
 */

import {
  type ArchitectureModel, type Finding, cloneModel, emptyModel,
} from "../model";
import { docflowModel, flawedCheckoutModel } from "../samples";
import { critiqueArchitecture } from "./critic";

export interface CorpusItem {
  id: string;
  label: string;
  kind: "valid" | "flawed" | "ambiguous" | "minimal" | "over-engineered" | "context-dependent";
  model: () => ArchitectureModel;
  /** ground truth: finding id prefixes the analyzers are expected to produce */
  expectedFindings: string[];
  /** findings that would be WRONG to produce on this item */
  mustNotFlag?: string[];
  uncertainty?: string;
}

function overEngineeredModel(): ArchitectureModel {
  const m = docflowModel();
  m.components.push({
    id: "kafka", kind: "broker", name: "Kafka cluster", purpose: "", config: { partitions: 64 },
    requirementIds: [],
  });
  m.connections.push({
    id: "cn-kafka", from: "kafka", to: "analytics", kind: "event", criticality: 1,
    failureBehavior: "isolated", operationIds: ["op-report"], requirementIds: [],
  });
  return m;
}

function minimalModel(): ArchitectureModel {
  const m = emptyModel("arch-minimal", "Minimal service");
  m.components = [
    { id: "svc", kind: "service", name: "The service", purpose: "", config: {}, requirementIds: [] },
    { id: "db", kind: "database", name: "The database", purpose: "", config: { connPool: 10 }, requirementIds: [] },
  ];
  m.connections = [{
    id: "e", from: "svc", to: "db", kind: "sync", criticality: 3,
    failureBehavior: "blocks", operationIds: [], requirementIds: [],
  }];
  return m;
}

export const BENCHMARK_CORPUS: CorpusItem[] = [
  {
    id: "docflow",
    label: "DocFlow reference (mostly sound, real tensions)",
    kind: "valid",
    model: docflowModel,
    expectedFindings: [
      "critic-spof:gateway", "critic-spof:upload-svc", "critic-spof:doc-store",
      "critic-idem:upload-svc",
      // NOTE: cn-worker-notify is async, so the sync-without-timeout rule
      // correctly does NOT fire (fire-and-forget cannot hang the caller)
    ],
    mustNotFlag: ["critic-orphan:"],
    uncertainty: "SPOF findings depend on declared redundancy; the seeded model intentionally leaves some single points.",
  },
  {
    id: "flawed-checkout",
    label: "Flawed checkout (benchmark fixture)",
    kind: "flawed",
    model: flawedCheckoutModel,
    expectedFindings: [
      "critic-spof:c-api", "critic-spof:c-db", "critic-spof:c-pay",
      "critic-idem:c-api", "critic-orphan:c-logging", "critic-sync-ext:k-2",
    ],
    mustNotFlag: [],
  },
  {
    id: "over-engineered",
    label: "DocFlow + unjustified Kafka",
    kind: "over-engineered",
    model: overEngineeredModel,
    expectedFindings: ["critic-orphan:kafka"],
    uncertainty: "the kafka finding overlaps docflow's own findings — corpus item measures the delta",
  },
  {
    id: "minimal",
    label: "Minimal service without intent",
    kind: "minimal",
    model: minimalModel,
    expectedFindings: ["critic-orphan:svc", "critic-orphan:db"],
    mustNotFlag: ["critic-spof:"], // no business operations exist: nothing is on a critical path
    uncertainty: "without operations, criticality-based rules are undefined by design",
  },
];

export interface ItemMetrics {
  corpusId: string;
  truePositives: string[];
  falsePositives: string[];
  falseNegatives: string[];
  precision: number;
  recall: number;
  falsePositiveRate: number;
  unsupportedClaims: string[];
}

export interface BenchmarkRun {
  ranAt: string;
  engine: "critic";
  items: ItemMetrics[];
  summary: { precision: number; recall: number; falsePositiveRate: number; unsupportedClaimRate: number };
  limitations: string[];
  /** delta vs a previously recorded run (null on first run) */
  deltaVsPrevious: { precision: number; recall: number } | null;
}

/** Finding ids are evidence-grounded iff every evidence ref resolves in the model. */
function unsupportedClaims(m: ArchitectureModel, findings: Finding[]): string[] {
  const comps = new Set(m.components.map((c) => `component:${c.id}`));
  const conns = new Set(m.connections.map((c) => `connection:${c.id}`));
  const reqs = new Set(m.requirements.map((r) => `requirement:${r.id}`));
  const adrs = new Set(m.adrs.map((a) => `adr:${a.id}`));
  const ops = new Set(m.operations.map((o) => `operation:${o.id}`));
  const slos = new Set(m.slos.map((s) => `slo:${s.id}`));
  const known = new Set([...comps, ...conns, ...reqs, ...adrs, ...ops, ...slos]);
  const bad: string[] = [];
  findings.forEach((f) => {
    f.evidence.forEach((e) => {
      const [kind] = e.ref.split(":");
      if (["component", "connection", "requirement", "adr", "operation", "slo"].includes(kind) && !known.has(e.ref)) {
        bad.push(`${f.id} -> ${e.ref}`);
      }
    });
  });
  return bad;
}

export function runBenchmark(previous: BenchmarkRun | null = null, ranAt = "unknown-date"): BenchmarkRun {
  const items: ItemMetrics[] = BENCHMARK_CORPUS.map((item) => {
    const model = item.model();
    const { findings } = critiqueArchitecture(model);
    const flagged = new Set(findings.map((f) => f.id));
    const truePositives: string[] = [];
    const falseNegatives: string[] = [];
    item.expectedFindings.forEach((exp) => {
      if (flagged.has(exp)) truePositives.push(exp);
      else falseNegatives.push(exp);
    });
    const extraFlags = findings
      .map((f) => f.id)
      .filter((id) => !item.expectedFindings.includes(id));
    // must-not-flag prefixes that were flagged anyway are hard errors
    const mustNotViolations = (item.mustNotFlag ?? [])
      .filter((pfx) => findings.some((f) => f.id.startsWith(pfx)))
      .map((pfx) => `must-not-flag ${pfx} was flagged`);
    const falsePositives = [...extraFlags, ...mustNotViolations];
    const precision = flagged.size === 0 ? 1 : truePositives.length / (truePositives.length + falsePositives.length);
    const recall = item.expectedFindings.length === 0 ? 1 : truePositives.length / item.expectedFindings.length;
    return {
      corpusId: item.id,
      truePositives, falsePositives, falseNegatives,
      precision: Math.round(precision * 1000) / 1000,
      recall: Math.round(recall * 1000) / 1000,
      falsePositiveRate: Math.round((falsePositives.length / Math.max(1, findings.length)) * 1000) / 1000,
      unsupportedClaims: unsupportedClaims(model, findings),
    };
  });

  const mean = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
  const summary = {
    precision: Math.round(mean(items.map((i) => i.precision)) * 1000) / 1000,
    recall: Math.round(mean(items.map((i) => i.recall)) * 1000) / 1000,
    falsePositiveRate: Math.round(mean(items.map((i) => i.falsePositiveRate)) * 1000) / 1000,
    unsupportedClaimRate: Math.round(
      (items.reduce((s, i) => s + i.unsupportedClaims.length, 0) /
        Math.max(1, items.reduce((s, i) => s + i.truePositives.length + i.falsePositives.length, 0))) * 1000) / 1000,
  };

  return {
    ranAt,
    engine: "critic",
    items,
    summary,
    limitations: [
      "The corpus covers the critic rule set; causal/blast-radius engines are exercised by their own unit suites, not scored here.",
      "Ground truth reflects documented system-design principles, which evolve with the rule set — a corpus update must accompany any rule change.",
      "Precision/recall are computed over finding IDs, not severity; severity calibration is a separate, unmodeled dimension.",
    ],
    deltaVsPrevious: previous
      ? {
          precision: Math.round((summary.precision - previous.summary.precision) * 1000) / 1000,
          recall: Math.round((summary.recall - previous.summary.recall) * 1000) / 1000,
        }
      : null,
  };
}

/** Task 41.5 — render an honest report from an EXECUTED run. */
export function renderBenchmarkReport(run: BenchmarkRun): string {
  const lines: string[] = [
    "# Architecture Intelligence Benchmark Report",
    "",
    `Run at: ${run.ranAt} (engine: ${run.engine})`,
    "",
    `Summary: precision ${run.summary.precision}, recall ${run.summary.recall}, ` +
      `false-positive rate ${run.summary.falsePositiveRate}, unsupported-claim rate ${run.summary.unsupportedClaimRate}.`,
    "",
    "| corpus | precision | recall | false positives | false negatives | unsupported claims |",
    "|--------|-----------|--------|-----------------|-----------------|--------------------|",
  ];
  run.items.forEach((i) => {
    lines.push(`| ${i.corpusId} | ${i.precision} | ${i.recall} | ${i.falsePositives.join(", ") || "none"} | ${i.falseNegatives.join(", ") || "none"} | ${i.unsupportedClaims.join(", ") || "none"} |`);
  });
  lines.push("", "## Limitations", "");
  run.limitations.forEach((l) => lines.push(`- ${l}`));
  if (run.deltaVsPrevious) {
    lines.push("", `## Delta vs previous run`,
      "", `precision ${run.deltaVsPrevious.precision >= 0 ? "+" : ""}${run.deltaVsPrevious.precision}, ` +
      `recall ${run.deltaVsPrevious.recall >= 0 ? "+" : ""}${run.deltaVsPrevious.recall}`);
  }
  return lines.join("\n");
}
