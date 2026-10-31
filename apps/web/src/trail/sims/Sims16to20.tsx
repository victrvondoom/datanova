/**
 * Simulations for topics 16-20 (Pub/Sub, EDA, Distributed Transactions,
 * Saga, Cron) plus the simulation registry.
 */
import React, { useState } from "react";
import { Button, Callout, LogView, Node, SimCard, Stat, StateBadge, Arrow } from "../ui";
import * as L from "./logic";

/* -------------------------------------------------- 16 Pub/Sub */

export const PubSubSim: React.FC<{ onInteract: () => void }> = ({ onInteract }) => {
  const [ps, setPs] = useState<L.PubSubSystem>(() => L.makePubSub());
  return (
    <div className="space-y-3">
      <SimCard title="order_created Topic" hint="one broadcast, independent subscribers">
        <div className="flex flex-wrap gap-2 mb-3">
          <Button variant="primary" onClick={() => { onInteract(); setPs((st) => L.publishEvent(st, "order_created")); }}>
            Place an order (publish event)
          </Button>
          {ps.subscribers.map((s) => (
            <Button key={s.name} onClick={() => { onInteract(); setPs((st) => L.toggleSubscriber(st, s.name)); }}>
              {s.online ? `⏸ Take ${s.name} offline` : `▶ Bring ${s.name} online`}
            </Button>
          ))}
          <Button variant="danger" onClick={() => setPs(L.makePubSub())}>Reset</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Node label="Order Service" state="healthy" sub="publisher" />
          <Arrow label="publish" />
          <Node label='TOPIC: "order_created"' state="processing" sub={`${ps.published} published`} />
          {ps.subscribers.map((s) => (
            <React.Fragment key={s.name}>
              <Arrow label={s.online ? "delivered" : "held (backlog)"} dashed={!s.online} blocked={!s.online} />
              <Node
                label={s.name}
                state={s.online ? "healthy" : "failed"}
                sub={s.online ? `${s.received} received` : `backlog: ${s.backlog}`}
              />
            </React.Fragment>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <Stat label="Events published" value={ps.published} />
          <Stat label="Offline subscribers" value={ps.subscribers.filter((s) => !s.online).length} tone="bad" />
          <Stat label="Held in backlog" value={ps.subscribers.reduce((a, s) => a + s.backlog, 0)} tone="bad" />
        </div>
      </SimCard>
      <LogView lines={ps.history} />
      <Callout kind="nuance" title="Production nuance">
        Publishing continues even while Analytics is offline — failure isolation is the entire point. But real
        pub/sub systems usually offer at-least-once delivery: subscribers must be idempotent, because a delivered
        event can be delivered again.
      </Callout>
    </div>
  );
};

/* -------------------------------------------------- 17 EDA */

export const EdaSim: React.FC<{ onInteract: () => void }> = ({ onInteract }) => {
  const [eda, setEda] = useState<L.EdaSystem>({ events: [], consumedBy: {} });
  const [bank, setBank] = useState<L.BankEvent[]>([]);
  const [nextTrace, setNextTrace] = useState(1);

  const publish = (event: "UserCreated" | "ItemAdded") => {
    onInteract();
    const traceId = `trace-${String(nextTrace).padStart(3, "0")}`;
    setNextTrace((n) => n + 1);
    const service = event === "UserCreated" ? "User Service" : "Cart Service";
    setEda((st) => L.edaPublish(st, event, service, traceId));
  };

  return (
    <div className="space-y-3">
      <SimCard title="Central Event Bus" hint="events, not commands — trace_id mandatory">
        <div className="flex flex-wrap gap-2 mb-3">
          <Button variant="primary" onClick={() => publish("UserCreated")}>User Service → publish UserCreated</Button>
          <Button onClick={() => publish("ItemAdded")}>Cart Service → publish ItemAdded</Button>
          <Button variant="danger" onClick={() => { setEda({ events: [], consumedBy: {} }); setBank([]); setNextTrace(1); }}>Reset</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Node label="User Service" state="healthy" sub="producer" />
          <Node label="Cart Service" state="healthy" sub="producer" />
          <Arrow label="events" />
          <Node label="Event Bus" state="processing" sub="Kafka / EventBridge" />
          <Arrow label="subscribe" />
          <Node label="Email Service" state="healthy" sub="consumer" />
          <Node label="Analytics Data Lake" state="healthy" sub="consumer" />
        </div>
        {eda.events.length > 0 && (
          <div className="mt-3 rounded-lg border border-slate-600/40 bg-slate-900/60 p-3 font-mono text-xs space-y-1">
            {eda.events.map((e, i) => (
              <div key={i} className="text-slate-300">
                <span className="text-sky-400">{e.service}</span> published{" "}
                <span className="text-emerald-400">{e.event}</span>{" "}
                <span className="text-amber-400">[{e.traceId}]</span>
                <div className="pl-4 text-slate-400">
                  └→ consumed by: {(L.EDA_CONSUMERS[e.event] ?? []).join(", ")} — trace_id now appears in every consumer's logs
                </div>
              </div>
            ))}
          </div>
        )}
      </SimCard>
      <SimCard title="Event Sourcing (advanced)" hint="state is the FOLD of events, not a stored row">
        <div className="flex flex-wrap gap-2 mb-3">
          <Button onClick={() => { onInteract(); setBank((b) => [...b, { type: "Deposit", amount: 50 }]); }}>Deposit($50)</Button>
          <Button onClick={() => { onInteract(); setBank((b) => [...b, { type: "Withdraw", amount: 10 }]); }}>Withdraw($10)</Button>
          <Button onClick={() => { onInteract(); setBank((b) => [...b, { type: "Deposit", amount: 60 }]); }}>Deposit($60)</Button>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="font-mono text-xs space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Event log</div>
            {bank.length === 0 && <p className="text-slate-500">(no events yet)</p>}
            {bank.map((e, i) => (
              <div key={i} className={e.type === "Deposit" ? "text-emerald-400" : "text-rose-400"}>
                {i + 1}. {e.type}(${e.amount})
              </div>
            ))}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Derived balance (not stored!)</div>
            <Stat label="Σ events" value={`$${L.foldBalance(bank)}`} tone="ok" />
          </div>
        </div>
      </SimCard>
      <Callout kind="nuance" title="Commands vs events">
        <b>Command:</b> "Ship this order now" (tells someone to act, couples you to them). <b>Event:</b>{" "}
        <code className="mx-1 rounded bg-slate-800 px-1">InvoicePaid</code> (an immutable fact; whoever cares reacts).
        Past-tense names keep the distinction honest.
      </Callout>
    </div>
  );
};

/* -------------------------------------------------- 18 Distributed Transactions */

export const TwoPCSim: React.FC<{ onInteract: () => void }> = ({ onInteract }) => {
  const [votes, setVotes] = useState<Record<string, L.TwoPCVote>>({ "Billing DB": "YES", "Rewards DB": "YES" });
  const [crashOnCommit, setCrashOnCommit] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<L.TwoPCOutcome | null>(null);
  const [phase, setPhase] = useState<L.TwoPCState | null>(null);

  const run = () => {
    onInteract();
    const prepared = L.twoPCPrepare(votes);
    setPhase(prepared);
    setOutcome(L.twoPCCommit(prepared, crashOnCommit ?? undefined));
  };

  return (
    <div className="space-y-3">
      <SimCard title="Two-Phase Commit (2PC)" hint="the old way — coordinator + prepare + commit">
        <div className="flex flex-wrap gap-2 items-center mb-3 text-xs text-slate-300">
          {(["Billing DB", "Rewards DB"] as const).map((db) => (
            <Button key={db} onClick={() => { onInteract(); setVotes((v) => ({ ...v, [db]: v[db] === "YES" ? "NO" : "YES" })); }}>
              {db}: vote {votes[db]}
            </Button>
          ))}
          <Button onClick={() => { onInteract(); setCrashOnCommit((c) => (c ? null : "Rewards DB")); }}>
            {crashOnCommit ? `✓ ${crashOnCommit} will CRASH during commit` : "Inject crash during commit"}
          </Button>
          <Button variant="primary" onClick={run}>Run transaction</Button>
          <Button variant="danger" onClick={() => { setVotes({ "Billing DB": "YES", "Rewards DB": "YES" }); setCrashOnCommit(null); setOutcome(null); setPhase(null); }}>Reset</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Node label="API Gateway" state="idle" />
          <Arrow label="transfer" />
          <Node label="Coordinator" state={phase ? "processing" : "idle"} sub="2PC" />
          <Arrow label="1. PREPARE?" />
          <Node label="Billing DB" sub="−$50" state={phase ? "waiting" : "idle"} />
          <Arrow label="1. PREPARE?" />
          <Node label="Rewards DB" sub="+$50" state={phase ? (crashOnCommit === "Rewards DB" ? "failed" : "waiting") : "idle"} />
        </div>
        {outcome && (
          <div className={`rounded-lg border p-3 text-sm font-mono ${
            outcome.kind === "committed"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : outcome.kind === "aborted"
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : "border-rose-500/40 bg-rose-500/10 text-rose-300"
          }`}>
            <div className="mb-1"><StateBadge state={outcome.kind === "committed" ? "recovered" : outcome.kind === "aborted" ? "waiting" : "failed"} label={outcome.kind.toUpperCase()} /></div>
            {outcome.detail}
          </div>
        )}
      </SimCard>
      <Callout kind="nuance" title="Why avoid this">
        2PC holds row locks across both databases while the coordinator waits on the network — extremely slow
        under failure. The two-database problem (Billing committed, Rewards crashed) is partial failure:
        money deducted, reward never credited. The better engineering answer is to design your boundaries so one
        transaction touches one database, and use Sagas (Topic 19) when you can't.
      </Callout>
    </div>
  );
};

/* -------------------------------------------------- 19 Saga */

export const SagaSim: React.FC<{ onInteract: () => void }> = ({ onInteract }) => {
  const [steps, setSteps] = useState<L.SagaStep[]>(() => L.makeSaga());
  const [log, setLog] = useState<string[]>([]);
  const [mode, setMode] = useState<L.SagaMode>("choreography");
  const [failAt, setFailAt] = useState<number>(3);

  const run = () => {
    onInteract();
    const r = L.runSaga(steps, failAt, mode);
    setSteps(r.steps);
    setLog(r.log);
  };

  return (
    <div className="space-y-3">
      <SimCard title="Order → Charge → Ship" hint="compensating transactions unwind failures">
        <div className="flex flex-wrap gap-2 items-center mb-3 text-xs text-slate-300">
          <Button variant={mode === "choreography" ? "primary" : "ghost"} onClick={() => { onInteract(); setMode("choreography"); }}>🎵 Choreography</Button>
          <Button variant={mode === "orchestration" ? "primary" : "ghost"} onClick={() => { onInteract(); setMode("orchestration"); }}>🎯 Orchestration</Button>
          <label className="flex items-center gap-2">
            fail at step
            <select value={failAt} onChange={(e) => setFailAt(Number(e.target.value))}
              className="bg-slate-800 border border-slate-600 rounded px-2 py-1 font-mono">
              <option value={0}>never (success)</option>
              <option value={1}>1 — Create Order</option>
              <option value={2}>2 — Charge Card</option>
              <option value={3}>3 — Ship Product</option>
            </select>
          </label>
          <Button variant="primary" onClick={run}>Run saga</Button>
          <Button variant="danger" onClick={() => { setSteps(L.makeSaga()); setLog([]); }}>Reset</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {steps.map((s, i) => (
            <React.Fragment key={s.name}>
              <Node
                label={s.name}
                state={
                  s.state === "done" ? "healthy"
                  : s.state === "failed" ? "failed"
                  : s.state === "compensated" ? "recovered"
                  : "idle"
                }
                sub={s.state === "pending" ? "pending" : s.state === "compensated" ? `↩ ${s.compensate}` : s.state}
              />
              {i < steps.length - 1 && <Arrow dashed={s.state !== "done"} />}
            </React.Fragment>
          ))}
        </div>
        <p className="text-[11px] text-slate-400">
          {mode === "choreography"
            ? "Choreography: each service reacts to the previous step's event automatically — good for simple flows, hard to track."
            : "Orchestration: a central Saga Manager tells every service what to do — better for complex flows (AWS Step Functions)."}
        </p>
      </SimCard>
      <LogView lines={log} />
      <Callout kind="warning" title="Compensation semantics — important">
        Compensating transactions are business-level corrective actions (a refund, a cancellation), NOT guaranteed
        restoration of the exact original database state. For a few seconds the order existed and the card was
        charged while shipping failed — that's eventual consistency, and your UI must show "Processing", not just "Done".
      </Callout>
    </div>
  );
};

/* -------------------------------------------------- 20 Cron */

export const CronSim: React.FC<{ onInteract: () => void }> = ({ onInteract }) => {
  const [c, setC] = useState<L.CronState>(() => L.makeCronState());
  const [log, setLog] = useState<string[]>([]);
  const [jobEnqueued, setJobEnqueued] = useState(true);

  const fire = () => {
    onInteract();
    const r = L.cronTick(c, jobEnqueued);
    setC(r.state);
    setLog((lg) => [...lg.slice(-40), `⏰ midnight tick #${r.state.runs}`, ...r.log]);
  };

  const nyHour = L.utcToLocalHour(0, -5, 1); // EST(-5) + DST

  return (
    <div className="space-y-3">
      <SimCard title="0 0 * * 0 — Cron Decoder" hint="weekly digest, Sunday midnight (server time)">
        <div className="flex flex-wrap gap-2 mb-3">
          {L.CRON_FIELDS.map((f) => (
            <div key={f.label} className="rounded-lg border border-slate-600/50 bg-slate-800/60 px-3 py-2 text-center">
              <div className="font-mono text-lg font-bold text-sky-300">{f.expr}</div>
              <div className="text-[10px] text-slate-400">{f.label}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center mb-3">
          <Button variant="primary" onClick={fire}>⏰ Fire the schedule (midnight)</Button>
          <Button onClick={() => { onInteract(); setC((st) => ({ ...st, distributedLock: !st.distributedLock })); }}>
            {c.distributedLock ? "🔒 Distributed lock: ON" : "⚠ Distributed lock: OFF"}
          </Button>
          <Button onClick={() => { onInteract(); setJobEnqueued((v) => !v); }}>
            {jobEnqueued ? "flow: scheduler → queue → worker" : "flow: scheduler does the work itself"}
          </Button>
          <Button variant="danger" onClick={() => { setC(L.makeCronState()); setLog([]); }}>Reset</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {c.servers.map((s) => (
            <Node
              key={s.server}
              label={s.server}
              state={s.emailsSent > (c.distributedLock ? 1 : 0) || (!c.distributedLock && s.emailsSent > 0) ? "processing" : "idle"}
              sub={`${s.emailsSent} email(s) sent`}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Total runs" value={c.runs} />
          <Stat label="Duplicate emails sent" value={c.servers.reduce((a, s) => a + s.emailsSent, 0) - c.runs} tone="bad" />
        </div>
      </SimCard>
      <LogView lines={log} />
      <Callout kind="warning" title="Timezone warning (from the handbook)">
        A cron set for <code className="mx-1 rounded bg-slate-800 px-1">0 0 * * *</code> runs at server time (usually
        UTC). New York users would get their "Morning Report" around {nyHour}:00 — and that hour shifts with
        Daylight Saving Time. Always store and process dates in UTC; give production schedulers an explicit
        timezone and a missed-run policy.
      </Callout>
    </div>
  );
};

