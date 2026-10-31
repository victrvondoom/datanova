/**
 * Simulations for topics 06-10 (Execution & first reliability topic).
 */
import React, { useState } from "react";
import { Button, Callout, LogView, Node, SimCard, Stat, StateBadge, Arrow } from "../ui";
import * as L from "./logic";

/* -------------------------------------------------- 06 CI/CD */

export const CiCdSim: React.FC<{ onInteract: () => void }> = ({ onInteract }) => {
  const [p, setP] = useState<L.PipelineState>(() => L.makePipeline());
  const run = () => { onInteract(); setP((st) => L.runPipeline(st)); };
  return (
    <div className="space-y-3">
      <SimCard title="CI/CD Pipeline" hint="Push → Build → Test → Package → Deploy">
        <div className="flex flex-wrap gap-2 mb-3">
          <Button variant="primary" onClick={run}>▶ Push code</Button>
          <Button onClick={() => { onInteract(); setP((st) => ({ ...st, injectFailingTest: !st.injectFailingTest })); }}>
            {p.injectFailingTest ? "✓ failing test injected" : "Inject failing test"}
          </Button>
          <Button onClick={() => { onInteract(); setP((st) => ({ ...st, injectBuildError: !st.injectBuildError })); }}>
            {p.injectBuildError ? "✓ build error injected" : "Inject build error"}
          </Button>
          <Button variant="danger" onClick={() => setP(L.makePipeline())}>Reset</Button>
        </div>
        <div className="flex flex-wrap items-center gap-1 mb-3">
          {["push", "build", "test", "package", "deploy"].map((st, i) => {
            const reached =
              p.stage === "deploy" ||
              (p.stage === "deploy-skipped" && i <= 2) ||
              (p.stage === "failed" && i <= 1);
            return (
              <React.Fragment key={st}>
                <Node label={st.toUpperCase()} state={reached ? (i === 4 && p.stage === "deploy-skipped" ? "blocked" : "healthy") : "idle"} active={reached} />
                {i < 4 && <Arrow blocked={p.stage === "deploy-skipped" && i === 2} />}
              </React.Fragment>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Pipeline runs" value={p.runs} />
          <Stat label="Production deploys" value={p.deploys} tone={p.deploys > 0 ? "ok" : "neutral"} />
        </div>
      </SimCard>
      <LogView lines={p.log} />
      <Callout kind="nuance" title="Production nuance">
        A pipeline with <code className="mx-1 rounded bg-slate-800 px-1">continue-on-error</code> or tests that are
        skipped to get a green build is decoration, not a gate. A red test must stop the line.
      </Callout>
    </div>
  );
};

/* -------------------------------------------------- 07 Docker */

export const DockerSim: React.FC<{ onInteract: () => void }> = ({ onInteract }) => {
  const [d, setD] = useState<L.DockerState>(() => L.makeDockerState());
  return (
    <div className="space-y-3">
      <SimCard title="Image vs Container" hint="one recipe, many running instances">
        <div className="flex flex-wrap gap-2 mb-3">
          <Button variant="primary" disabled={d.images > 0} onClick={() => { onInteract(); setD(L.dockerBuild); }}>docker build</Button>
          <Button disabled={d.images === 0} onClick={() => { onInteract(); setD((st) => L.dockerRun(st)); }}>docker run</Button>
          <Button variant="danger" onClick={() => setD(L.makeDockerState())}>Reset</Button>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <Stat label="Images (recipes)" value={d.images} />
          <Stat label="Containers running" value={d.containers.filter((c) => c.running).length} tone="ok" />
          <Stat label="Containers stopped" value={d.containers.filter((c) => !c.running).length} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Node label="Dockerfile" state={d.images > 0 ? "recovered" : "idle"} sub="recipe" />
          <Arrow label="build" dashed={d.images === 0} />
          <Node label={`Image ×${d.images}`} state={d.images > 0 ? "healthy" : "idle"} sub="read-only snapshot" />
          {d.containers.slice(0, 4).map((c) => (
            <React.Fragment key={c.id}>
              <Arrow label="run" />
              <Node label={c.id} state={c.running ? "processing" : "idle"} sub={c.running ? "running" : "stopped"} />
            </React.Fragment>
          ))}
        </div>
        {d.containers.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {d.containers.map((c) => (
              <Button key={c.id} variant={c.running ? "ghost" : "primary"} onClick={() => { onInteract(); setD((st) => L.dockerStop(st, c.id)); }}>
                {c.running ? `docker stop ${c.id}` : `${c.id} stopped`}
              </Button>
            ))}
          </div>
        )}
      </SimCard>
      <SimCard title="Virtual Machine vs Docker Container">
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-rose-500/30 p-3">
            <div className="font-bold text-rose-300 mb-2">Virtual Machine (heavy)</div>
            <div className="space-y-1 text-slate-300">
              <div className="rounded bg-slate-800 px-2 py-1">App A</div>
              <div className="rounded bg-slate-800 px-2 py-1">Guest OS (GBs!)</div>
              <div className="rounded bg-slate-900 px-2 py-1">Hypervisor → Host OS</div>
              <p className="text-xs mt-1">Boots in minutes.</p>
            </div>
          </div>
          <div className="rounded-lg border border-emerald-500/30 p-3">
            <div className="font-bold text-emerald-300 mb-2">Docker (light)</div>
            <div className="space-y-1 text-slate-300">
              <div className="flex gap-1"><span className="rounded bg-slate-800 px-2 py-1 flex-1">App A</span><span className="rounded bg-slate-800 px-2 py-1 flex-1">App B</span></div>
              <div className="rounded bg-slate-800 px-2 py-1">Docker Engine (shared)</div>
              <div className="rounded bg-slate-900 px-2 py-1">Host OS kernel</div>
              <p className="text-xs mt-1">Starts in milliseconds.</p>
            </div>
          </div>
        </div>
      </SimCard>
      <Callout kind="nuance" title="Portability honesty">
        "If the container runs on your laptop it is mathematically guaranteed to run the same way in the cloud" is an
        educational simplification. Containers share the host kernel: architecture differences, kernel versions,
        resource limits, and host-level configs can still change behavior. Consistency improves — it is not an absolute guarantee.
      </Callout>
    </div>
  );
};

/* -------------------------------------------------- 08 Kubernetes */

export const KubernetesSim: React.FC<{ onInteract: () => void }> = ({ onInteract }) => {
  const [k, setK] = useState<L.KubeState>(() => L.makeKubeState());
  const [autoHeal, setAutoHeal] = useState(true);
  const crash = () => {
    onInteract();
    setK((st) => {
      const crashed = L.kubeCrashRandomPod(st);
      return autoHeal ? L.kubeReconcile(crashed) : crashed;
    });
  };
  return (
    <div className="space-y-3">
      <SimCard title="Desired State & Self-Healing" hint="the control plane reconciles reality toward the YAML">
        <div className="flex flex-wrap gap-2 items-center mb-3">
          <label className="flex items-center gap-2 text-xs text-slate-300">
            desired replicas
            <input
              type="number"
              min={1}
              max={8}
              value={k.desired}
              onChange={(e) => { onInteract(); setK((st) => L.kubeSetDesired(st, Number(e.target.value))); }}
              className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1 font-mono"
            />
          </label>
          <Button variant="danger" onClick={crash}>💥 Crash a pod</Button>
          <Button onClick={() => { onInteract(); setK((st) => L.kubeReconcile(st)); }}>Run reconciler</Button>
          <Button onClick={() => setAutoHeal((v) => !v)}>{autoHeal ? "auto-heal: ON" : "auto-heal: OFF"}</Button>
          <Button variant="danger" onClick={() => setK(L.makeKubeState(k.desired))}>Reset</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Node label="Control Plane" state="healthy" sub="watches desired state" />
          <Arrow label="schedule / heal" />
          <div className="flex flex-wrap gap-2">
            {k.pods.map((p) => (
              <Node key={p.id} label={p.id} state={p.phase === "Running" ? "healthy" : "failed"} sub={p.phase} />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Desired" value={k.desired} />
          <Stat label="Running" value={k.pods.filter((p) => p.phase === "Running").length} tone="ok" />
          <Stat label="Reconciliations" value={k.reconciliations} />
        </div>
      </SimCard>
      <LogView lines={k.events} />
      <Callout kind="nuance" title="Kubernetes honesty">
        Do not use Kubernetes for a simple MVP. It solves massive orchestration problems by adding massive
        operational overhead. This simulation is illustrative — nothing here is actually running 50 containers.
      </Callout>
    </div>
  );
};

/* -------------------------------------------------- 09 Service Discovery */

export const ServiceDiscoverySim: React.FC<{ onInteract: () => void }> = ({ onInteract }) => {
  const [d, setD] = useState<L.DiscoveryState>(() => L.makeDiscoveryState());
  const [directIp, setDirectIp] = useState(d.currentIp);
  const restart = () => {
    onInteract();
    setD((st) => {
      const next = L.discoveryRestartPod(st, `10.0.1.${20 + st.ipHistory.length * 7}`);
      setDirectIp(st.currentIp); // Service A "remembers" the old IP
      return next;
    });
  };
  return (
    <div className="space-y-3">
      <SimCard title="Direct IP vs Service Name" hint="pods are ephemeral; names are stable">
        <div className="flex flex-wrap gap-2 mb-3">
          <Button onClick={restart}>↻ Restart Auth Pod (new IP)</Button>
          <Button onClick={() => { onInteract(); setD((st) => L.discoveryCallDirectIp(st, directIp)); }}>
            Service A calls hardcoded IP <span className="font-mono ml-1">{directIp}</span>
          </Button>
          <Button variant="primary" onClick={() => { onInteract(); setD((st) => L.discoveryCallServiceName(st)); }}>
            Service A calls http://auth-service
          </Button>
          <Button variant="danger" onClick={() => { setD(L.makeDiscoveryState()); setDirectIp("10.0.1.17"); }}>Reset</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Node label="Service A" state={d.directCallResult === "stale-ip-fail" ? "failed" : "processing"} />
          {d.directCallResult === "stale-ip-fail" ? (
            <>
              <Arrow label="hardcoded (stale)" blocked />
              <Node label={`old pod ${directIp}`} state="failed" sub="gone" />
            </>
          ) : (
            <>
              <Arrow label={d.serviceCallResult === "ok" ? "service name" : "call…"} dashed={d.serviceCallResult !== "ok"} />
              <Node label="Service Discovery" state={d.serviceCallResult === "ok" ? "processing" : "idle"} sub="internal DNS" />
              {d.serviceCallResult === "ok" && (
                <>
                  <Arrow label={`→ ${d.resolvedIp}`} />
                  <Node label="Auth Pod" state="healthy" sub={d.currentIp} />
                </>
              )}
            </>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Stat label="Current Auth Pod IP" value={d.currentIp} />
          <Stat
            label="Last direct-IP call"
            value={d.directCallResult === "stale-ip-fail" ? "FAILED (stale IP)" : d.directCallResult === "ok" ? "ok" : "—"}
            tone={d.directCallResult === "stale-ip-fail" ? "bad" : "neutral"}
          />
        </div>
        <p className="text-xs text-slate-400 mt-2 font-mono">IP history: {d.ipHistory.join(" → ")}</p>
      </SimCard>
    </div>
  );
};

/* -------------------------------------------------- 10 Circuit Breaker */

export const CircuitBreakerSim: React.FC<{ onInteract: () => void }> = ({ onInteract }) => {
  const [b, setB] = useState<L.CircuitBreaker>(() => L.makeBreaker());
  const [downstreamUp, setDownstreamUp] = useState(true);
  const [log, setLog] = useState<string[]>([]);

  React.useEffect(() => {
    if (b.state !== "open") return;
    const iv = window.setInterval(() => {
      setB((cur) => {
        const next = L.breakerTickCooldown(cur, 0.5);
        if (next.state === "half-open" && cur.state === "open") {
          setLog((lg) => [...lg.slice(-40), "◐ cooldown over → HALF-OPEN: next call is a probe"]);
        }
        return next;
      });
    }, 500);
    return () => window.clearInterval(iv);
  }, [b.state]);

  const call = () => {
    onInteract();
    setB((cur) => {
      const r = L.breakerCall(cur, downstreamUp);
      setLog((lg) => [
        ...lg.slice(-40),
        r.outcome === "success"
          ? `200 OK from Service B (successes: ${r.breaker.successCount})`
          : r.outcome === "slow-fail"
            ? `✗ slow failure #${r.breaker.consecutiveFailures} (timeout)`
            : "⚡ FAST FAIL — circuit is OPEN, Service B was not called at all",
      ]);
      return r.breaker;
    });
  };

  return (
    <div className="space-y-3">
      <SimCard title="Circuit Breaker States" hint="5 consecutive slow failures → open">
        <div className="flex flex-wrap gap-2 mb-3">
          <Button variant="primary" onClick={call}>Service A calls Service B</Button>
          <Button onClick={() => setDownstreamUp((v) => !v)}>
            {downstreamUp ? "Service B: healthy" : "Service B: overloaded (slow)"}
          </Button>
          <Button onClick={() => { onInteract(); call(); call(); call(); call(); call(); }}>×5 in a row</Button>
          <Button variant="danger" onClick={() => { setB(L.makeBreaker()); setLog([]); setDownstreamUp(true); }}>Reset</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Node label="Service A" state={b.state === "closed" ? "healthy" : b.state === "open" ? "degraded" : "processing"} />
          <Node
            label={`Breaker: ${b.state.toUpperCase()}`}
            state={b.state === "closed" ? "healthy" : b.state === "open" ? "blocked" : "retrying"}
            sub={b.state === "open" ? `cooldown ${b.cooldownRemaining.toFixed(1)}s` : ""}
          />
          <Arrow blocked={b.state === "open"} label={b.state === "open" ? "no calls forwarded" : "calls"} />
          <Node label="Service B" state={downstreamUp ? "healthy" : "failed"} />
        </div>
        <div className="grid grid-cols-4 gap-2">
          <Stat label="Consecutive failures" value={b.consecutiveFailures} tone={b.consecutiveFailures >= b.threshold ? "bad" : "neutral"} />
          <Stat label="Successes" value={b.successCount} tone="ok" />
          <Stat label="Fast fails (open)" value={b.fastFails} tone="bad" />
          <Stat label="Threshold" value={b.threshold} />
        </div>
      </SimCard>
      <SimCard title="Degraded E-Commerce Experience">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3">
            <div className="font-bold text-emerald-300 text-sm mb-1">Shopping cart</div>
            <p className="text-xs text-slate-300">Continues to work perfectly — critical path protected.</p>
            <div className="mt-1"><StateBadge state="healthy" label="Fully functional" /></div>
          </div>
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
            <div className="font-bold text-amber-300 text-sm mb-1">⚠ Recommendations unavailable</div>
            <p className="text-xs text-slate-300">
              The recommendation service failed; the circuit breaker caught it and returned an empty list —
              a degraded but functional experience.
            </p>
            <div className="mt-1"><StateBadge state="degraded" label="Fallback shown" /></div>
          </div>
        </div>
      </SimCard>
      <LogView lines={log} />
    </div>
  );
};
