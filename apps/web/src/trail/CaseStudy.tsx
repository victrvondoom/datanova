/**
 * End-to-end case study: viral AI-PDF SaaS.
 *
 * Illustrative walkthrough of the handbook's architecture. This is a visual
 * simulation of a request lifecycle — NOT a load test and NOT a claim that
 * the architecture can actually serve 10,000 concurrent users.
 */
import React, { useEffect, useRef, useState } from "react";
import { Button, Callout, Node, SimCard, Stat, StateBadge, Arrow, LogView } from "./ui";
import { backoffDelay } from "./sims/logic";

interface Step {
  title: string;
  nodes: string[];
  narrative: string[];
}

const STEPS: Step[] = [
  {
    title: "Step 1 — Protection",
    nodes: ["users", "edge", "gateway"],
    narrative: [
      "10,000 users arrive after the viral post.",
      "The edge rate limiter blocks the bots; the gateway validates each user's token ONCE and routes the request.",
    ],
  },
  {
    title: "Step 2 — Fast data",
    nodes: ["users", "gateway", "lb", "web", "cache", "db"],
    narrative: [
      "User requests their dashboard.",
      "The app checks Redis — cache hit returns instantly (dashboard shows \"served from cache\").",
      "Cache miss would query the database and back-fill the cache.",
    ],
  },
  {
    title: "Step 3 — Heavy processing",
    nodes: ["users", "gateway", "lb", "web", "idem", "queue"],
    narrative: [
      "User clicks \"Generate 100-page PDF\".",
      "The app creates an idempotency key (so a retry can't double-charge) and drops a job into the message queue.",
      "The user immediately receives a \"processing\" response — no 10-second spinner.",
    ],
  },
  {
    title: "Step 4 — Resilience",
    nodes: ["queue", "worker", "aiapi"],
    narrative: [
      "A worker pulls the job and calls the external AI API.",
      "The API times out — the worker retries with exponential backoff and jitter (max 3 attempts).",
      "It eventually succeeds, or the job moves to the failure-handling path (DLQ) for inspection.",
    ],
  },
  {
    title: "Step 5 — Events and billing",
    nodes: ["worker", "pubsub", "saga"],
    narrative: [
      "The worker publishes a PDF_Generated event.",
      "The billing saga consumes it and coordinates the charge — with a compensating refund if a step fails.",
      "The UI displays the actual processing state, never a fake \"Done\".",
    ],
  },
  {
    title: "Step 6 — Operations",
    nodes: ["cron", "queue", "worker", "pubsub"],
    narrative: [
      "A cron scheduler (behind a distributed lock) enqueues periodic maintenance jobs.",
      "Workers process the queue; monitoring shows failures and recovery.",
      "The system remains operational end to end.",
    ],
  },
];

const ALL_NODES: { id: string; label: string; sub: string }[] = [
  { id: "users", label: "10,000 Users", sub: "viral spike" },
  { id: "edge", label: "Edge Rate Limiter", sub: "blocks bots (T1)" },
  { id: "gateway", label: "API Gateway", sub: "auth & routing (T5)" },
  { id: "lb", label: "Load Balancer", sub: "distributes (T3/4)" },
  { id: "web", label: "Web Service", sub: "K8s/Docker (T7/8)" },
  { id: "cache", label: "Redis Cache", sub: "fast data (T2)" },
  { id: "db", label: "Database", sub: "source of truth" },
  { id: "idem", label: "Idempotency Store", sub: "keys (T14)" },
  { id: "queue", label: "Message Queue", sub: "async work (T15)" },
  { id: "worker", label: "Worker Service", sub: "retries + backoff (T12/13)" },
  { id: "aiapi", label: "External AI API", sub: "the flaky dependency" },
  { id: "pubsub", label: "Pub/Sub", sub: "events (T16/17)" },
  { id: "saga", label: "Billing Saga", sub: "compensation (T19)" },
  { id: "cron", label: "Cron Job", sub: "scheduled (T20)" },
];

export const CaseStudyView: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [step, setStep] = useState(-1);
  const [running, setRunning] = useState(false);
  const [aiApiDown, setAiApiDown] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [metrics, setMetrics] = useState({ cacheHits: 0, cacheMisses: 0, queueDepth: 0, retries: 0, jobsDone: 0 });
  const completedRef = useRef(false);

  useEffect(() => {
    if (!running) return;
    const iv = window.setInterval(() => advance(), 2200);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, step, aiApiDown]);

  const advance = () => {
    const next = Math.min(step + 1, STEPS.length - 1);
    setStep(next);
    if (next !== step) narrate(next);
    if (next === STEPS.length - 1) {
      setRunning(false);
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete();
      }
    }
  };

  const narrate = (idx: number) => {
    const st = STEPS[idx];
    const lines: string[] = [`▶ ${st.title}`];
    for (const n of st.narrative) lines.push(`   ${n}`);
    if (idx === 1) {
      const hits = 12;
      setMetrics((m) => ({ ...m, cacheHits: m.cacheHits + hits, cacheMisses: m.cacheMisses + 2 }));
      lines.push(`   dashboard: ${hits} cache hits / 2 misses (DB protected by Redis)`);
    }
    if (idx === 2) {
      setMetrics((m) => ({ ...m, queueDepth: m.queueDepth + 5 }));
      lines.push("   queue depth: +5 PDF jobs — users already got their 200 responses");
    }
    if (idx === 3) {
      if (aiApiDown) {
        const d1 = backoffDelay(1, 1000, 0.25);
        const d2 = backoffDelay(2, 1000, 0.25);
        setMetrics((m) => ({ ...m, retries: m.retries + 3, queueDepth: Math.max(0, m.queueDepth - 1) }));
        lines.push(`   ⚠ AI API is DOWN: attempt 1 fails → wait ${d1}ms`);
        lines.push(`   ⚠ attempt 2 fails → wait ${d2}ms (exponential + jitter)`);
        lines.push(`   ⚠ attempt 3 fails → job moved to the DLQ for inspection; user sees an honest failure state`);
      } else {
        const d1 = backoffDelay(1, 1000, 0.25);
        setMetrics((m) => ({ ...m, retries: m.retries + 1, queueDepth: Math.max(0, m.queueDepth - 1), jobsDone: m.jobsDone + 1 }));
        lines.push(`   attempt 1 times out → wait ${d1}ms (backoff + jitter)`);
        lines.push("   attempt 2 succeeds → PDF generated, job done");
      }
    }
    if (idx === 4) {
      setMetrics((m) => ({ ...m, jobsDone: m.jobsDone }));
      lines.push("   PDF_Generated → billing saga charges → UI shows the real processing state");
    }
    if (idx === 5) {
      setMetrics((m) => ({ ...m, queueDepth: 0 }));
      lines.push("   cron (single-run via distributed lock) enqueues maintenance → workers drain the queue");
    }
    setLog((lg) => [...lg.slice(-80), ...lines]);
  };

  const reset = () => {
    setStep(-1);
    setRunning(false);
    completedRef.current = false;
    setLog([]);
    setMetrics({ cacheHits: 0, cacheMisses: 0, queueDepth: 0, retries: 0, jobsDone: 0 });
  };

  const activeNodes = step >= 0 ? new Set(STEPS[step].nodes) : new Set<string>();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-100">Case Study: Vibe-Coding a Viral SaaS</h2>
        <p className="text-sm text-slate-400 mt-1">
          An AI-powered PDF generation SaaS receives 10,000 users after a viral post. Watch the 20 topics
          cooperate to keep it alive.
        </p>
      </div>

      <Callout kind="warning" title="What this is (and is not)">
        This is an illustrative simulation of a request lifecycle, rendered in your browser. It is NOT a load
        test and NOT evidence that this architecture can actually serve 10,000 concurrent users — no real
        infrastructure is running here.
      </Callout>

      <SimCard title="Architecture" hint="active components light up per step">
        <div className="flex flex-wrap gap-2 items-center">
          {ALL_NODES.slice(0, 4).map((n) => (
            <React.Fragment key={n.id}>
              <Node label={n.label} sub={n.sub} state={activeNodes.has(n.id) ? "processing" : "idle"} active={activeNodes.has(n.id)} />
              <Arrow dashed={!activeNodes.has(n.id)} />
            </React.Fragment>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center mt-2">
          {ALL_NODES.slice(4, 9).map((n) => (
            <React.Fragment key={n.id}>
              <Node label={n.label} sub={n.sub} state={activeNodes.has(n.id) ? "processing" : "idle"} active={activeNodes.has(n.id)} />
              <Arrow dashed={!activeNodes.has(n.id)} />
            </React.Fragment>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center mt-2">
          {ALL_NODES.slice(9).map((n) => (
            <React.Fragment key={n.id}>
              <Node
                label={n.label}
                sub={n.sub}
                state={n.id === "aiapi" && aiApiDown ? "failed" : activeNodes.has(n.id) ? "processing" : "idle"}
                active={activeNodes.has(n.id)}
              />
              <Arrow dashed={!activeNodes.has(n.id)} />
            </React.Fragment>
          ))}
        </div>
      </SimCard>

      <div className="flex flex-wrap gap-2 items-center">
        <Button variant="primary" onClick={() => { if (step === -1) { setStep(0); narrate(0); } else { setRunning((r) => !r); } }}>
          {step === -1 ? "▶ Start scenario" : running ? "⏸ Pause" : "▶ Resume"}
        </Button>
        <Button onClick={() => { if (step === STEPS.length - 1) return; advance(); }}>Advance one step</Button>
        <Button variant={aiApiDown ? "primary" : "danger"} onClick={() => setAiApiDown((v) => !v)}>
          {aiApiDown ? "Restore AI API" : "Inject: AI API failure"}
        </Button>
        <Button variant="danger" onClick={reset}>Reset simulation</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Stat label="Cache hits" value={metrics.cacheHits} tone="ok" />
        <Stat label="Cache misses" value={metrics.cacheMisses} />
        <Stat label="Queue depth" value={metrics.queueDepth} tone={metrics.queueDepth > 3 ? "bad" : "neutral"} />
        <Stat label="Retries (with backoff)" value={metrics.retries} tone={metrics.retries > 0 ? "bad" : "neutral"} />
        <Stat label="Jobs completed" value={metrics.jobsDone} tone="ok" />
      </div>

      {step >= 0 && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
          <div className="flex items-center gap-2 mb-1">
            <StateBadge state="processing" label={`Step ${step + 1} of 6`} />
            <span className="font-bold text-slate-100">{STEPS[step].title}</span>
          </div>
          {STEPS[step].narrative.map((n, i) => (
            <p key={i} className="text-sm text-slate-300">{n}</p>
          ))}
          {step === 3 && aiApiDown && (
            <p className="text-sm text-rose-300 font-semibold mt-1">
              ⚠ The injected failure is live: every PDF job will exhaust its retries and land in the DLQ.
            </p>
          )}
        </div>
      )}

      <LogView lines={log} />
    </div>
  );
};
