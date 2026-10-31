/**
 * Simulations for topics 11-15 (Timeouts, Retries, Backoff,
 * Idempotency, Queues & DLQ).
 */
import React, { useState } from "react";
import { Button, Callout, LogView, Node, SimCard, Stat, Arrow } from "../ui";
import * as L from "./logic";

/* -------------------------------------------------- 11 Timeouts */

export const TimeoutSim: React.FC<{ onInteract: () => void }> = ({ onInteract }) => {
  const [timeoutMs, setTimeoutMs] = useState(2000);
  const [responseMs, setResponseMs] = useState(200);
  const [result, setResult] = useState<L.TimeoutResult | null>(null);
  const call = () => { onInteract(); setResult(L.timeoutCall(timeoutMs, responseMs)); };
  return (
    <div className="space-y-3">
      <SimCard title="Request Deadline Simulator" hint="the handbook's 2-second example">
        <div className="flex flex-wrap gap-4 mb-3 text-xs text-slate-300">
          <label className="flex items-center gap-2">
            timeout
            <input type="range" min={500} max={5000} step={100} value={timeoutMs}
              onChange={(e) => { onInteract(); setTimeoutMs(Number(e.target.value)); setResult(null); }}
              className="accent-sky-400" />
            <span className="font-mono">{timeoutMs}ms</span>
          </label>
          <label className="flex items-center gap-2">
            Service B response time
            <input type="range" min={100} max={8000} step={100} value={responseMs}
              onChange={(e) => { onInteract(); setResponseMs(Number(e.target.value)); setResult(null); }}
              className="accent-rose-400" />
            <span className="font-mono">{responseMs}ms</span>
          </label>
          <Button variant="primary" onClick={call}>Service A → Service B</Button>
          <Button variant="danger" onClick={() => { setResult(null); setTimeoutMs(2000); setResponseMs(200); }}>Reset</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Node label="Service A" state={result ? (result.ok ? "healthy" : "failed") : "idle"} />
          <Arrow label={result?.ok ? "200 OK" : result ? "⏱ timeout" : "call"} blocked={result ? !result.ok : false} />
          <Node
            label="Service B"
            state={responseMs > timeoutMs ? "failed" : "healthy"}
            sub={result?.ok ? `${responseMs}ms` : `would answer in ${responseMs}ms`}
          />
        </div>
        {result && (
          <div className={`rounded-lg border p-3 text-sm font-mono ${result.ok ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-rose-500/40 bg-rose-500/10 text-rose-300"}`}>
            {result.message}
          </div>
        )}
        <div className="mt-3 relative h-6 bg-slate-900 rounded border border-slate-700">
          <div className="absolute inset-y-0 left-0 bg-sky-500/30 border-r border-sky-400" style={{ width: `${(timeoutMs / 8000) * 100}%` }} />
          <div className="absolute inset-y-0 w-1 bg-rose-400" style={{ left: `${(responseMs / 8000) * 100}%` }} />
          <div className="absolute right-1 top-0 text-[10px] text-slate-400 leading-6">8s scale</div>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          Blue band = deadline window. Red line = when Service B would answer. Red beyond the band ⇒ timeout fires first.
        </p>
      </SimCard>
      <Callout kind="nuance" title="Production nuance">
        Without timeouts, one slow dependency pins every worker thread and cascades into a full outage. The exact
        number (2s here) is an illustration — set deadlines from your SLO for the operation, not from the worst case.
      </Callout>
    </div>
  );
};

/* -------------------------------------------------- 12 Retries */

export const RetrySim: React.FC<{ onInteract: () => void }> = ({ onInteract }) => {
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [failureType, setFailureType] = useState<"s503" | "network" | "s400">("s503");
  const [successOnAttempt, setSuccessOnAttempt] = useState(3); // 0 = never succeeds
  const [log, setLog] = useState<string[]>([]);
  const [finalOutcome, setFinalOutcome] = useState<string | null>(null);

  const run = () => {
    onInteract();
    const status = failureType === "s503" ? 503 : failureType === "network" ? -1 : 400;
    const lines: string[] = [];
    let outcome: string | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const succeedsNow = successOnAttempt !== 0 && attempt >= successOnAttempt;
      const thisStatus = succeedsNow ? 200 : status;
      lines.push(`attempt ${attempt}/${maxAttempts} → HTTP ${thisStatus}`);
      if (succeedsNow) {
        outcome = `✓ SUCCESS on attempt ${attempt} — the user never saw an error`;
        break;
      }
      const d = L.retryStep(attempt, maxAttempts, thisStatus);
      lines.push(`   ${d.reason}`);
      if (d.action === "fail") {
        outcome = `✗ ${d.reason}`;
        break;
      }
    }
    if (outcome === null) outcome = L.retryStep(maxAttempts, maxAttempts, status).reason;
    setLog(lines);
    setFinalOutcome(outcome);
  };

  return (
    <div className="space-y-3">
      <SimCard title="Retry Policy Simulator" hint="transient vs non-retryable errors">
        <div className="flex flex-wrap gap-2 items-center mb-3 text-xs text-slate-300">
          <label className="flex items-center gap-2">
            max attempts
            <select value={maxAttempts} onChange={(e) => { onInteract(); setMaxAttempts(Number(e.target.value)); }}
              className="bg-slate-800 border border-slate-600 rounded px-2 py-1 font-mono">
              <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option><option value={5}>5</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            failure type
            <select value={failureType} onChange={(e) => { onInteract(); setFailureType(e.target.value as typeof failureType); }}
              className="bg-slate-800 border border-slate-600 rounded px-2 py-1 font-mono">
              <option value="s503">503 Service Unavailable</option>
              <option value="network">network error</option>
              <option value="s400">400 Bad Request</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            succeeds on attempt
            <select value={successOnAttempt} onChange={(e) => { onInteract(); setSuccessOnAttempt(Number(e.target.value)); }}
              className="bg-slate-800 border border-slate-600 rounded px-2 py-1 font-mono">
              <option value={0}>never</option><option value={2}>2</option><option value={3}>3</option>
            </select>
          </label>
          <Button variant="primary" onClick={run}>Run call</Button>
          <Button variant="danger" onClick={() => { setLog([]); setFinalOutcome(null); }}>Reset</Button>
        </div>
        <LogView lines={log} />
        {finalOutcome && (
          <div className={`mt-2 rounded-lg border p-2 text-sm font-mono ${finalOutcome.startsWith("✓") ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-rose-500/40 bg-rose-500/10 text-rose-300"}`}>
            {finalOutcome}
          </div>
        )}
      </SimCard>
      <Callout kind="nuance" title="Production nuance">
        Retrying writes (payments, emails) is only safe with idempotency (Topic 14). And every retry costs the
        struggling server capacity — always combine retries with backoff + jitter (Topic 13).
      </Callout>
    </div>
  );
};

/* -------------------------------------------------- 13 Exponential Backoff */

export const BackoffSim: React.FC<{ onInteract: () => void }> = ({ onInteract }) => {
  const [log, setLog] = useState<string[]>([]);
  const [clients, setClients] = useState(10);
  const [withJitter, setWithJitter] = useState(true);

  const run = () => {
    onInteract();
    const lines: string[] = [];
    let ok = false;
    for (let attempt = 1; attempt <= 4; attempt++) {
      const delay = L.backoffDelay(attempt, 1000, withJitter ? 0.25 : 0);
      lines.push(`attempt ${attempt} → HTTP 503 → wait ${delay}ms${withJitter ? " (with jitter)" : ""}`);
      if (attempt === 4) {
        lines.push(`attempt 4 → HTTP 200 ✓ success after ~${(Math.pow(2, 0) + 1000 + 2000 + 4000) / 1000}s total`);
        ok = true;
      }
    }
    setLog(lines);
    const wavesNo = L.synchronizedWaves(3, clients);
    const wavesYes = L.jitteredWave(3, clients);
    setWaveData({ no: wavesNo, yes: wavesYes, ok });
  };
  const [waveData, setWaveData] = useState<{ no: L.RetryWave[]; yes: L.RetryWave[]; ok: boolean } | null>(null);

  return (
    <div className="space-y-3">
      <SimCard title="Backoff + Jitter Sequence" hint="1s → 2s → 4s, decorrelated">
        <div className="flex flex-wrap gap-2 items-center mb-3 text-xs text-slate-300">
          <label className="flex items-center gap-2">
            simulated clients
            <input type="number" min={2} max={100} value={clients}
              onChange={(e) => setClients(Math.max(2, Math.min(100, Number(e.target.value))))}
              className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1 font-mono" />
          </label>
          <Button onClick={() => setWithJitter((v) => !v)}>{withJitter ? "jitter: ON" : "jitter: OFF"}</Button>
          <Button variant="primary" onClick={run}>Run retry sequence</Button>
          <Button variant="danger" onClick={() => { setLog([]); setWaveData(null); }}>Reset</Button>
        </div>
        <LogView lines={log} />
        {waveData && (
          <div className="mt-3 grid sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/5 p-3">
              <div className="text-xs font-bold text-rose-300 mb-2 uppercase tracking-wider">Without jitter — synchronized waves</div>
              <div className="h-24 relative bg-slate-900 rounded">
                {waveData.no.map((w, i) => (
                  <div key={i} className="absolute bottom-1 bg-rose-500/70 rounded-sm"
                    style={{ left: `${(w.t / 8) * 100}%`, width: "4%", height: `${Math.min(100, w.clients)}%` }}
                    title={`t=${w.t}s: ${w.clients} clients retry at once`} />
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {clients} clients retry at t=0s, 1s, 3s — identical waves that can DDoS the recovering server.
              </p>
            </div>
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3">
              <div className="text-xs font-bold text-emerald-300 mb-2 uppercase tracking-wider">With jitter — spread out</div>
              <div className="h-24 relative bg-slate-900 rounded">
                {waveData.yes.map((w, i) => (
                  <div key={i} className="absolute bottom-1 bg-emerald-500/70 rounded-sm"
                    style={{ left: `${(w.t / 8) * 100}%`, width: "1.5%", height: "20%" }}
                    title={`t=${w.t.toFixed(1)}s: 1 client`} />
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                The same retries decorrelated into a smooth drizzle the server can absorb.
              </p>
            </div>
          </div>
        )}
      </SimCard>
    </div>
  );
};

/* -------------------------------------------------- 14 Idempotency */

export const IdempotencySim: React.FC<{ onInteract: () => void }> = ({ onInteract }) => {
  const [state, setState] = useState<L.IdempotencyState>(() => L.makeIdempotencyState());
  const [key, setKey] = useState("b7f1-uuid-42");
  const [scenario, setScenario] = useState<"bad" | "good">("bad");
  const [log, setLog] = useState<string[]>([]);

  const runScenario = () => {
    onInteract();
    setState(L.makeIdempotencyState());
    setLog([]);
    let s = L.makeIdempotencyState();
    if (scenario === "bad") {
      const s1 = L.charge(s, { amount: 50 }, false);
      setLog((lg) => [...lg, `POST /charge {amount: $50} — NO idempotency key`, `   ${s1.lastAction}`]);
      const s2 = L.charge(s1, { amount: 50 }, true);
      setLog((lg) => [...lg, `Client retries POST /charge (no key to recognize)`, `   ${s2.lastAction}`, `💸 Balance: $${s2.balance} — charged TWICE. The customer is furious.`]);
      setState(s2);
    } else {
      const s1 = L.charge(s, { amount: 50, idempotencyKey: key }, false);
      setLog((lg) => [...lg, `POST /charge {amount: $50}  Idempotency-Key: ${key}`, `   ${s1.lastAction}`]);
      const s2 = L.charge(s1, { amount: 50, idempotencyKey: key }, true);
      setLog((lg) => [...lg, `Client retries with the SAME key ${key}`, `   ${s2.lastAction}`, `✓ Balance: $${s2.balance} — charged exactly once.`]);
      setState(s2);
    }
  };

  return (
    <div className="space-y-3">
      <SimCard title="Payment Retry: $50 Charge" hint="watch the ledger and the balance">
        <div className="flex flex-wrap gap-2 items-center mb-3 text-xs text-slate-300">
          <Button variant={scenario === "bad" ? "danger" : "ghost"} onClick={() => { onInteract(); setScenario("bad"); }}>
            Bad: no idempotency key
          </Button>
          <Button variant={scenario === "good" ? "primary" : "ghost"} onClick={() => { onInteract(); setScenario("good"); }}>
            Good: with Idempotency-Key
          </Button>
          <label className="flex items-center gap-1 font-mono">
            key
            <input value={key} onChange={(e) => setKey(e.target.value)}
              className="w-40 bg-slate-800 border border-slate-600 rounded px-2 py-1 font-mono text-xs" />
          </label>
          <Button variant="primary" onClick={runScenario}>Run scenario (charge + lost response + retry)</Button>
          <Button variant="danger" onClick={() => { setState(L.makeIdempotencyState()); setLog([]); }}>Reset</Button>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <Stat label="Balance" value={`$${state.balance}`} tone={state.charges <= 1 ? "ok" : "bad"} />
          <Stat label="Charges made" value={state.charges} tone={state.charges <= 1 ? "ok" : "bad"} />
          <Stat label="Keys recognized" value={state.processedKeys.size} tone="ok" />
        </div>
        <div className="rounded-lg border border-slate-600/40 bg-slate-900/60 p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">Transaction ledger</div>
          {state.ledger.length === 0 ? (
            <p className="text-xs text-slate-500">No transactions yet — run a scenario.</p>
          ) : (
            <div className="space-y-1 font-mono text-xs">
              {state.ledger.map((e, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-slate-500">#{i + 1}</span>
                  <span className={e.key ? "text-emerald-400" : "text-rose-400"}>{e.key ?? "(no key)"}</span>
                  <span className="text-slate-300">{e.result}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </SimCard>
      <LogView lines={log} />
      <Callout kind="nuance" title="Method idempotency vs application behavior">
        GET/PUT/DELETE being idempotent is an HTTP convention. What matters is application behavior: a PUT that
        increments a counter is not idempotent in effect. For money endpoints, use explicit idempotency keys —
        don't rely on method semantics.
      </Callout>
    </div>
  );
};

/* -------------------------------------------------- 15 Queues & DLQ */

export const QueueSim: React.FC<{ onInteract: () => void }> = ({ onInteract }) => {
  const [q, setQ] = useState<L.QueueSystem>(() => L.makeQueueSystem());
  const [log, setLog] = useState<string[]>([]);

  const step = () => {
    onInteract();
    setQ((cur) => {
      const next = L.queueTick(cur);
      const job = next.jobs.find((j) => j.state === "done" && !log.includes(`✓ ${j.id} done`));
      if (job) {
        setLog((lg) => [...lg.slice(-40), `✓ ${job.id} (${job.label}) processed after ${job.attempts} attempt(s)`]);
      } else {
        const attempted = next.jobs.find((j) => j.attempts > 0 && j.state === "dlq");
        const retrying = next.jobs.find((j) => j.state === "queued" && j.attempts > 0);
        if (attempted) {
          setLog((lg) => [...lg.slice(-40), `⚠ ${attempted.id} failed ${L.DLQ_THRESHOLD}× → moved to DEAD LETTER QUEUE (poison message isolated)`]);
        } else if (retrying) {
          setLog((lg) => [...lg.slice(-40), `✗ ${retrying.id} failed → returned to queue (attempt ${retrying.attempts}/${L.DLQ_THRESHOLD})`]);
        }
      }
      return next;
    });
  };

  const queued = q.jobs.filter((j) => j.state === "queued");
  const dlq = q.jobs.filter((j) => j.state === "dlq");
  const done = q.jobs.filter((j) => j.state === "done");

  return (
    <div className="space-y-3">
      <SimCard title="Signup Workflow Queue" hint="web server → queue → workers (max 3 attempts → DLQ)">
        <div className="flex flex-wrap gap-2 mb-3">
          <Button variant="primary" onClick={() => { onInteract(); setQ((st) => L.enqueueJob(st, "welcome_email")); }}>Submit signup job</Button>
          <Button onClick={() => { onInteract(); setQ((st) => L.enqueueJob(st, "pdf_report")); }}>Submit PDF job</Button>
          <Button onClick={() => { onInteract(); setQ((st) => ({ ...st, workersOnline: st.workersOnline === 0 ? 1 : 0 })); }}>
            {q.workersOnline === 0 ? "▶ Start worker" : "⏹ Stop worker"}
          </Button>
          <Button onClick={() => { onInteract(); setQ((st) => ({ ...st, emailApiUp: !st.emailApiUp })); }}>
            {q.emailApiUp ? "Email API: up" : "Email API: DOWN"}
          </Button>
          <Button onClick={step}>Worker tick (pull 1 job)</Button>
          <Button variant="danger" onClick={() => { setQ(L.makeQueueSystem()); setLog([]); }}>Reset</Button>
        </div>
        <div className="flex flex-wrap items-stretch gap-2">
          <Node label="Web Server" state="healthy" sub="enqueue only" />
          <Arrow label="instant 200" />
          <div className="rounded-lg border border-slate-500/50 bg-slate-700/40 px-3 py-2 min-w-[9rem]">
            <div className="text-sm font-semibold text-slate-100">Main Queue</div>
            <div className="text-[11px] text-slate-400">{queued.length} job(s) waiting</div>
            <div className="mt-1 space-y-0.5">
              {queued.slice(0, 5).map((j) => (
                <div key={j.id} className="font-mono text-[10px] text-sky-300">{j.id} {j.label}{j.attempts > 0 ? ` (attempt ${j.attempts + 1})` : ""}</div>
              ))}
            </div>
          </div>
          <Arrow label={q.workersOnline > 0 ? "pull" : "no workers"} blocked={q.workersOnline === 0} />
          <Node label={q.workersOnline > 0 ? "Worker A" : "Workers OFF"} state={q.workersOnline > 0 ? (q.emailApiUp ? "processing" : "failed") : "idle"} sub={q.emailApiUp ? "healthy" : "email API down"} />
          <Arrow label={`after ${L.DLQ_THRESHOLD} failures`} dashed />
          <div className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 min-w-[9rem]">
            <div className="text-sm font-semibold text-rose-300">Dead Letter Queue</div>
            <div className="text-[11px] text-slate-400">{dlq.length} poison job(s)</div>
            <div className="mt-1">
              {dlq.map((j) => (
                <div key={j.id} className="font-mono text-[10px] text-rose-400">{j.id} {j.label}</div>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <Stat label="Processed" value={q.processed} tone="ok" />
          <Stat label="In DLQ" value={dlq.length} tone={dlq.length > 0 ? "bad" : "neutral"} />
          <Stat label="Done" value={done.length} />
        </div>
      </SimCard>
      <LogView lines={log} />
    </div>
  );
};
