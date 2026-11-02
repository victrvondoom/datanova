/** Shared visual vocabulary for canvas + SVG export (label + dash + color: never color alone). */
import { Category, ConnType } from "./model";

export const CONN_STYLE: Record<ConnType, { color: string; dash: string; label: string; glyph: string }> = {
  sync: { color: "#38bdf8", dash: "", label: "Synchronous request", glyph: "→" },
  async: { color: "#fb923c", dash: "8 5", label: "Asynchronous message", glyph: "⇢" },
  event: { color: "#a78bfa", dash: "2 5", label: "Event publication", glyph: "⇝" },
  data: { color: "#94a3b8", dash: "", label: "Data access", glyph: "⇒" },
  schedule: { color: "#2dd4bf", dash: "10 4 2 4", label: "Scheduled trigger", glyph: "⏱" },
};

export const CATEGORY_COLOR: Record<Category, string> = {
  entry: "#0ea5e9",
  application: "#22c55e",
  data: "#eab308",
  async: "#f97316",
  reliability: "#ef4444",
  distributed: "#a855f7",
};

export const NODE_W = 168;
export const NODE_H = 62;

export const KIND_ABBR: Record<string, string> = {
  client: "CLIENT", cdn: "CDN", rate_limiter: "LIMIT", reverse_proxy: "PROXY", load_balancer: "LB", api_gateway: "GATEWAY", web_app: "WEB",
  app_service: "SERVICE", auth_service: "AUTH", worker: "WORKER", cron_runner: "CRON", postgres: "DB", redis_cache: "CACHE", object_storage: "OBJECTS",
  idempotency_store: "IDEMP", queue: "QUEUE", dlq: "DLQ", pubsub: "TOPIC", event_bus: "BUS", circuit_breaker: "BREAKER", timeout: "TIMEOUT",
  retry_policy: "RETRY", health_check: "HEALTH", tx_coordinator: "2PC", saga: "SAGA", external_service: "EXTERNAL",
};

export const STATE_VISUAL: Record<string, { label: string; icon: string; color: string }> = {
  healthy: { label: "Healthy", icon: "✓", color: "#22c55e" },
  failed: { label: "Failed", icon: "✗", color: "#f43f5e" },
  degraded: { label: "Degraded", icon: "⚠", color: "#f59e0b" },
  recovered: { label: "Recovered", icon: "✔", color: "#14b8a6" },
  recovering: { label: "Recovering", icon: "↻", color: "#38bdf8" },
  retrying: { label: "Retrying", icon: "↻", color: "#f59e0b" },
  blocked: { label: "Blocked", icon: "⛔", color: "#f43f5e" },
  waiting: { label: "Waiting", icon: "…", color: "#94a3b8" },
  processing: { label: "Processing", icon: "⟳", color: "#38bdf8" },
  idle: { label: "Idle", icon: "○", color: "#64748b" },
};
