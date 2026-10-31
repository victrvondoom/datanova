/**
 * Simulations for topics 01-05 (Entry & Routing).
 * Each simulation is driven by the pure logic in ./logic.
 */
import React, { useEffect, useRef, useState } from "react";
import { Button, Callout, LogView, Node, SimCard, Stat, StateBadge, Arrow } from "../ui";
import * as L from "./logic";

/* -------------------------------------------------- 01 Token Bucket */

export const TokenBucketSim: React.FC<{ onInteract: () => void }> = ({ onInteract }) => {
  const [bucket, setBucket] = useState<L.TokenBucket>(() => L.makeBucket());
  const [log, setLog] = useState<string[]>([]);
  const [auto, setAuto] = useState<{ on: boolean; rps: number }>({ on: false, rps: 8 });
  const autoRef = useRef(auto);
  useEffect(() => {
    autoRef.current = auto;
  }, [auto]);

  // continuous refill (10/s default) + optional auto traffic
  useEffect(() => {
    const iv = window.setInterval(() => {
      setBucket((b) => L.refillBucket(b, 0.25));
      const a = autoRef.current;
      if (a.on) {
        setBucket((b) => {
          let nb = b;
          for (let i = 0; i < a.rps; i++) {
            const r = L.bucketRequest(nb);
            if (!r.allowed) {
              setLog((lg) => [
                ...lg.slice(-60),
                `429 Too Many Requests — bucket empty, retry after ${r.retryAfterSeconds.toFixed(1)}s`,
              ]);
            }
            nb = r.bucket;
          }
          return nb;
        });
        onInteract();
      }
    }, 250);
    return () => window.clearInterval(iv);
  }, [onInteract]);

  const send = (count: number) => {
    onInteract();
    setBucket((b) => {
      let nb = b;
      let rejected = 0;
      for (let i = 0; i < count; i++) {
        const r = L.bucketRequest(nb);
        if (!r.allowed) rejected += 1;
        nb = r.bucket;
      }
      setLog((lg) => [
        ...lg.slice(-60),
        `Burst of ${count}: ${count - rejected} accepted (200), ${rejected} rejected (429)`,
      ]);
      return nb;
    });
  };

  return (
    <div className="space-y-3">
      <SimCard title="Token Bucket Simulator" hint="capacity 100 · refill 10/s · cost 1 token/request">
        <div className="flex flex-wrap gap-2 mb-3">
          <Button variant="primary" onClick={() => send(1)}>Send 1 request</Button>
          <Button onClick={() => send(10)}>Burst ×10</Button>
          <Button onClick={() => send(150)}>Bot flood ×150</Button>
          <Button onClick={() => setAuto((a) => ({ ...a, on: !a.on }))}>
            {auto.on ? "⏸ Stop auto traffic" : "▶ Auto traffic"}
          </Button>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            frequency
            <input
              type="range"
              min={1}
              max={40}
              value={auto.rps}
              onChange={(e) => setAuto((a) => ({ ...a, rps: Number(e.target.value) }))}
              className="accent-sky-400"
            />
            <span className="font-mono">{auto.rps}/s</span>
          </label>
          <Button variant="danger" onClick={() => { setBucket(L.makeBucket()); setLog([]); }}>Reset</Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <Stat label="Tokens available" value={bucket.tokens.toFixed(1)} />
          <Stat label="Accepted (200)" value={bucket.accepted} tone="ok" />
          <Stat label="Rejected (429)" value={bucket.rejected} tone="bad" />
          <Stat label="Bucket fill" value={`${Math.round((bucket.tokens / bucket.capacity) * 100)}%`} />
        </div>
        <div className="h-3 rounded-full bg-slate-900 border border-slate-700 overflow-hidden mb-3" role="img" aria-label={`Bucket fill level: ${Math.round(bucket.tokens)} of ${bucket.capacity} tokens`}>
          <div className="h-full bg-sky-400/70 transition-all duration-200 motion-reduce:transition-none" style={{ width: `${(bucket.tokens / bucket.capacity) * 100}%` }} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Node label="Bot (IP 1.1)" sub={`${bucket.rejected} rejected`} state={bucket.tokens < 1 ? "blocked" : "processing"} />
          <Arrow label="HTTP 200 / 429" blocked={bucket.tokens < 1} />
          <Node label="API Gateway" sub="token bucket" state="healthy" />
          <Arrow />
          <Node label="App Server" state="healthy" sub="protected" />
        </div>
      </SimCard>
      <LogView lines={log} />
      <Callout kind="nuance" title="Production nuance">
        This simulator runs in your browser. In production, the shared counter lives in Redis at the edge so
        ALL gateway instances agree on the count — application-level limiters only see their own process's traffic.
      </Callout>
    </div>
  );
};

/* -------------------------------------------------- 02 Cache-Aside */

export const CacheSim: React.FC<{ onInteract: () => void }> = ({ onInteract }) => {
  const [s, setS] = useState<L.CacheState>(() => L.makeCacheState());
  const act = (fn: (st: L.CacheState) => L.CacheState) => {
    onInteract();
    setS((st) => {
      const next = fn(st);
      return next === st ? st : { ...next };
    });
  };
  const cached = Object.keys(s.cache).length > 0;
  return (
    <div className="space-y-3">
      <SimCard title="Cache-Aside Walkthrough" hint="key: user:123 · TTL 60s">
        <div className="flex flex-wrap gap-2 mb-3">
          <Button variant="primary" onClick={() => act((st) => L.cacheRead(st, "user:123"))}>Request profile (read)</Button>
          <Button onClick={() => act((st) => L.dbUpdate(st, "user:123", "Alice — bio v2 (updated)"))}>Update DB bio</Button>
          <Button onClick={() => act((st) => L.tickCacheTtl(st, 60))}>Expire cache key (TTL)</Button>
          <Button onClick={() => act((st) => L.forceRefresh(st, "user:123"))}>Force refresh (bust cache)</Button>
          <Button variant="danger" onClick={() => setS(L.makeCacheState())}>Reset</Button>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <Stat label="Cache hits" value={s.hits} tone="ok" />
          <Stat label="Cache misses" value={s.misses} tone="bad" />
          <Stat label="DB queries" value={s.dbQueries} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Node label="App Server" state="processing" />
          <Arrow label="1. check" dashed />
          <Node label="Redis Cache" sub={cached ? "user:123 ✓" : "empty"} state={cached ? "healthy" : "idle"} />
          <Arrow label="2. miss → query" dashed={!cached} />
          <Node label="Postgres DB" sub={`v${s.db["user:123"]?.version ?? 0}`} state="healthy" />
        </div>
        <p className="text-xs text-slate-400 mt-2 font-mono">last action: {s.lastAction || "—"}</p>
      </SimCard>
      <LogView lines={[]} max={1} />
      {s.lastAction && (
        <Callout kind="info" title="Read path">
          <span className="font-mono">{s.lastAction}</span>
        </Callout>
      )}
      <Callout kind="nuance" title="Production nuance">
        Cache invalidation is a correctness problem, not just a performance one. "Delete the key on write + TTL
        as a safety net" is the standard defense — TTL alone leaves a staleness window equal to the TTL.
      </Callout>
    </div>
  );
};

/* -------------------------------------------------- 03 Load Balancer */

export const LoadBalancerSim: React.FC<{ onInteract: () => void }> = ({ onInteract }) => {
  const [servers, setServers] = useState<L.LbServer[]>(() => L.makeLbServers());
  const [rr, setRr] = useState(0);
  const [log, setLog] = useState<string[]>([]);

  const send = (count: number) => {
    onInteract();
    setServers((sv) => {
      let cur = sv;
      let idx = rr;
      for (let i = 0; i < count; i++) {
        const r = L.lbRoute(cur, idx++);
        cur = r.servers;
        setLog((lg) => [
          ...lg.slice(-40),
          r.target
            ? `${r.status} → ${r.target.name}`
            : "503 Service Unavailable — no healthy backends",
        ]);
      }
      setRr(idx);
      return cur;
    });
  };

  return (
    <div className="space-y-3">
      <SimCard title="Round-Robin Load Balancer" hint="health checks eject dead nodes">
        <div className="flex flex-wrap gap-2 mb-3">
          <Button variant="primary" onClick={() => send(1)}>Send 1 request</Button>
          <Button onClick={() => send(10)}>Send 10</Button>
          <Button onClick={() => send(50)}>Traffic spike ×50</Button>
          {servers.map((sv) => (
            <Button
              key={sv.name}
              variant={sv.healthy ? "ghost" : "danger"}
              onClick={() => { onInteract(); setServers((cur) => L.toggleServer(cur, sv.name)); }}
            >
              {sv.healthy ? `Kill ${sv.name}` : `Restore ${sv.name}`}
            </Button>
          ))}
          <Button variant="danger" onClick={() => { setServers(L.makeLbServers()); setRr(0); setLog([]); }}>Reset</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Node label="Clients" state="processing" />
          <Arrow label="one URL" />
          <Node label="Load Balancer" state="healthy" sub="round robin" />
          {servers.map((sv) => (
            <React.Fragment key={sv.name}>
              <Arrow label="health ✓" dashed={!sv.healthy} blocked={!sv.healthy} />
              <Node
                label={sv.name}
                sub={`${sv.requests} req`}
                state={sv.healthy ? "healthy" : "failed"}
              />
            </React.Fragment>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          {servers.map((sv) => (
            <Stat key={sv.name} label={sv.name} value={sv.requests} tone={sv.healthy ? "ok" : "bad"} />
          ))}
        </div>
      </SimCard>
      <LogView lines={log} />
    </div>
  );
};

/* -------------------------------------------------- 04 Reverse Proxy */

const PROXY_STEPS = [
  "Client opens HTTPS to the proxy — TLS encrypted traffic arrives",
  "Proxy terminates SSL (decrypts here, not in the app)",
  "Path check: /static/* → served directly from disk, backend never bothered",
  "Dynamic route → forwarded to the backend over plain HTTP inside the network",
  "Backend responds → proxy gzips the response and returns it to the client",
];

export const ReverseProxySim: React.FC<{ onInteract: () => void }> = ({ onInteract }) => {
  const [step, setStep] = useState(-1);
  const [path, setPath] = useState("/api/report");
  const next = () => { onInteract(); setStep((s) => (s + 1) % PROXY_STEPS.length); };
  const isStatic = path.startsWith("/static/");
  return (
    <div className="space-y-3">
      <SimCard title="Request Flow Through Nginx" hint="click through each stage">
        <div className="flex flex-wrap gap-2 mb-3 items-center">
          <label className="text-xs text-slate-300 flex items-center gap-2">
            request path
            <select
              value={path}
              onChange={(e) => { onInteract(); setPath(e.target.value); setStep(-1); }}
              className="bg-slate-800 border border-slate-600 rounded px-2 py-1 font-mono text-xs"
            >
              <option value="/api/report">/api/report (dynamic)</option>
              <option value="/static/app.js">/static/app.js (static file)</option>
            </select>
          </label>
          <Button variant="primary" onClick={next}>{step === -1 ? "Start request" : "Next stage"}</Button>
          <Button variant="danger" onClick={() => setStep(-1)}>Reset</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Node label="Client" state={step >= 0 ? "processing" : "idle"} sub="https" />
          <Arrow label={step >= 1 ? "TLS terminated ✓" : "TLS"} dashed={step < 1} />
          <Node
            label="Nginx Reverse Proxy"
            state={step >= 0 ? "processing" : "idle"}
            sub={isStatic ? "serves from disk" : "proxies to backend"}
          />
          <Arrow label={isStatic ? "not needed" : "plain http"} dashed={step < 3 || isStatic} blocked={isStatic} />
          <Node
            label="App Server"
            state={step >= 3 && !isStatic ? "processing" : "idle"}
            sub={isStatic ? "shielded" : "express/django"}
          />
        </div>
        <ol className="text-sm text-slate-300 space-y-1">
          {PROXY_STEPS.map((s2, i) => (
            <li key={i} className={i === step ? "text-sky-300 font-semibold" : i < step ? "text-slate-400" : "text-slate-600"}>
              {i + 1}. {s2}
            </li>
          ))}
        </ol>
      </SimCard>
      <SimCard title="Reverse Proxy vs Load Balancer">
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-slate-600/40 p-3">
            <div className="font-bold text-sky-300 mb-1">Load Balancer</div>
            <p className="text-slate-300">Primary job: <b>distribute</b> traffic, ensure high availability. Tools: AWS ALB, HAProxy.</p>
          </div>
          <div className="rounded-lg border border-slate-600/40 p-3">
            <div className="font-bold text-sky-300 mb-1">Reverse Proxy</div>
            <p className="text-slate-300">Primary job: <b>modify & shield</b> — SSL termination, compression, static routing. Tools: Nginx, Caddy.</p>
          </div>
        </div>
      </SimCard>
    </div>
  );
};

/* -------------------------------------------------- 05 API Gateway */

export const ApiGatewaySim: React.FC<{ onInteract: () => void }> = ({ onInteract }) => {
  const [path, setPath] = useState(L.GATEWAY_ROUTES[0].path);
  const [jwtValid, setJwtValid] = useState(true);
  const [rateExceeded, setRateExceeded] = useState(false);
  const [serviceDown, setServiceDown] = useState(false);
  const [gatewayDown, setGatewayDown] = useState(false);
  const [result, setResult] = useState<L.GatewayResult | null>(null);

  const send = () => {
    onInteract();
    const route = L.GATEWAY_ROUTES.find((r) => r.path === path)!;
    setResult(L.gatewayHandle(route, jwtValid, rateExceeded, serviceDown, gatewayDown));
  };

  return (
    <div className="space-y-3">
      <SimCard title="Gateway Request Router" hint="one entry point, cross-cutting concerns">
        <div className="flex flex-wrap gap-2 items-center mb-3">
          <select
            value={path}
            onChange={(e) => { onInteract(); setPath(e.target.value); setResult(null); }}
            className="bg-slate-800 border border-slate-600 rounded px-2 py-1 font-mono text-xs"
            aria-label="Endpoint path"
          >
            {L.GATEWAY_ROUTES.map((r) => (
              <option key={r.path} value={r.path}>{r.path}</option>
            ))}
          </select>
          <Button onClick={() => { onInteract(); setJwtValid((v) => !v); }}>{jwtValid ? "✓ valid JWT" : "✗ invalid JWT"}</Button>
          <Button onClick={() => { onInteract(); setRateExceeded((v) => !v); }}>{rateExceeded ? "rate limit: exceeded" : "rate limit: ok"}</Button>
          <Button onClick={() => { onInteract(); setServiceDown((v) => !v); }}>{serviceDown ? "service: down" : "service: up"}</Button>
          <Button variant={gatewayDown ? "danger" : "ghost"} onClick={() => { onInteract(); setGatewayDown((v) => !v); }}>
            {gatewayDown ? "kill gateway (SPOF)" : "gateway healthy"}
          </Button>
          <Button variant="primary" onClick={send}>Send request</Button>
          <Button variant="danger" onClick={() => { setResult(null); setJwtValid(true); setRateExceeded(false); setServiceDown(false); setGatewayDown(false); }}>Reset</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Node label="Mobile App" state={result ? "processing" : "idle"} />
          <Arrow label="one URL" dashed={!result} />
          <Node
            label="API Gateway"
            sub="verify JWT · rate limit · route"
            state={gatewayDown ? "failed" : result ? "processing" : "idle"}
          />
          {L.GATEWAY_ROUTES.map((r) => (
            <React.Fragment key={r.path}>
              <Arrow
                label={r.path}
                dashed={!(result?.reachedService && result.route?.path === r.path)}
                blocked={serviceDown && r.path === path && result?.status === 503}
              />
              <Node
                label={r.service}
                state={serviceDown && r.path === path ? "failed" : "healthy"}
                active={result?.reachedService && result.route?.path === r.path}
              />
            </React.Fragment>
          ))}
        </div>
        {result && (
          <div className="mt-3 rounded-lg border border-slate-600/40 bg-slate-900/60 p-3 font-mono text-xs">
            <div className="mb-1"><StateBadge state={result.status === 200 ? "healthy" : result.status === 429 ? "blocked" : "failed"} label={`HTTP ${result.status}`} /></div>
            <div className="text-slate-300">{result.message}</div>
          </div>
        )}
      </SimCard>
      <Callout kind="nuance" title="Security nuance — trusted identity context">
        The gateway validates the token ONCE and passes a trusted User ID downstream. But downstream services
        must not blindly trust arbitrary client-supplied identity headers: any client could set
        <code className="mx-1 rounded bg-slate-800 px-1">X-User-Id: 1</code> themselves. The trusted identity context must be
        established by the gateway and protected by internal network controls so external traffic can never inject it.
      </Callout>
    </div>
  );
};
