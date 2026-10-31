"""Serving-integrity components for the AEGIS-Fraud X API.

Implements catalog features:
- AFX-F001 ingest_idem / api_idempotency: idempotent scoring by transaction_id
- api_rate_limiting: per-client token-bucket on mutating endpoints
- obs_request_ids: request correlation IDs
- govern_decision_log: append-only JSONL decision ledger (receipt-linked)
- deploy_readiness_checks: readiness separate from liveness

Design notes:
- Everything is in-memory (single-process deployment, documented limitation);
  the ledger also appends to disk so decisions survive restarts.
- The idempotency cache is a bounded LRU: re-delivery within the window
  returns the ORIGINAL decision without re-applying side effects (graph
  mutation, ledger append); after eviction the event is reprocessed.
- Rate limiting is a token bucket per client identity with documented
  defaults; it protects a demonstration service, not a public fleet.
"""

import json
import logging
import os
import threading
import time
import uuid
from collections import OrderedDict
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger("aegis.integrity")


class IdempotencyCache:
    """Bounded LRU mapping transaction_id -> stored decision result."""

    def __init__(self, capacity: int = 4096):
        self.capacity = capacity
        self._store: "OrderedDict[str, Dict[str, Any]]" = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            if key in self._store:
                self._store.move_to_end(key)
                return self._store[key]
            return None

    def put(self, key: str, value: Any) -> None:
        with self._lock:
            if key in self._store:
                self._store.move_to_end(key)
                return
            self._store[key] = value
            if len(self._store) > self.capacity:
                self._store.popitem(last=False)

    def __len__(self) -> int:
        return len(self._store)


class TokenBucketRateLimiter:
    """Per-client token bucket. Returns (allowed, retry_after_seconds)."""

    def __init__(self, rate_per_minute: float = 120.0, burst: int = 30):
        self.rate = rate_per_minute / 60.0
        self.burst = burst
        self._buckets: Dict[str, Tuple[float, float]] = {}  # client -> (tokens, last_ts)
        self._lock = threading.Lock()

    def allow(self, client: str) -> Tuple[bool, float]:
        now = time.monotonic()
        with self._lock:
            tokens, last = self._buckets.get(client, (float(self.burst), now))
            tokens = min(float(self.burst), tokens + (now - last) * self.rate)
            if tokens >= 1.0:
                self._buckets[client] = (tokens - 1.0, now)
                return True, 0.0
            self._buckets[client] = (tokens, now)
            return False, (1.0 - tokens) / self.rate


class DecisionLedger:
    """Append-only JSONL ledger of scored decisions, receipt-linked.

    Each record carries: transaction id, timestamp, model/calibration/policy
    provenance, calibrated probability, action, receipt hash, and the
    artifact run id. No raw transaction payloads are stored beyond the
    identifiers needed for audit (data minimization).
    """

    def __init__(self, path: str = "benchmarks/runs/decision_ledger.jsonl", capacity: int = 8192):
        self.path = path
        self.capacity = capacity
        self._index: "OrderedDict[str, Dict[str, Any]]" = OrderedDict()
        self._lock = threading.Lock()
        self._ensure_dir()

    def _ensure_dir(self) -> None:
        d = os.path.dirname(self.path)
        if d:
            os.makedirs(d, exist_ok=True)

    def append(self, record: Dict[str, Any]) -> None:
        with self._lock:
            with open(self.path, "a", encoding="utf-8") as f:
                f.write(json.dumps(record, sort_keys=True, default=str) + "\n")
            self._index[record["transaction_id"]] = record
            if len(self._index) > self.capacity:
                self._index.popitem(last=False)

    def get(self, transaction_id: str) -> Optional[Dict[str, Any]]:
        return self._index.get(transaction_id)

    def recent(self, limit: int = 50, offset: int = 0):
        """Insertion-ordered page of archived decisions."""
        items = list(self._index.values())
        return items[offset : offset + limit]

    def __len__(self) -> int:
        return len(self._index)


class MetricsRegistry:
    """In-memory per-endpoint operational counters (single-process scope).

    Deliberately simple: counters are process-local and reset on restart —
    documented as demo-scale observability, not a distributed metrics store.
    """

    def __init__(self) -> None:
        self.started_at = time.time()
        self._counters: Dict[str, int] = {}
        self._lock = threading.Lock()

    def incr(self, event: str, amount: int = 1) -> None:
        with self._lock:
            self._counters[event] = self._counters.get(event, 0) + amount

    def observe_request(self, path: str, status: int) -> None:
        """Classify one completed request into stable counter names."""
        with self._lock:
            key = f"requests:{path}"
            self._counters[key] = self._counters.get(key, 0) + 1
            bucket = "responses:2xx" if status < 300 else (
                "responses:4xx" if status < 500 else "responses:5xx"
            )
            self._counters[bucket] = self._counters.get(bucket, 0) + 1
            if status == 429:
                self._counters["rate_limited"] = self._counters.get("rate_limited", 0) + 1

    def snapshot(self) -> Dict[str, Any]:
        with self._lock:
            counters = dict(self._counters)
        return {
            "started_at": self.started_at,
            "uptime_seconds": round(time.time() - self.started_at, 1),
            "counters": counters,
            "note": "process-local counters; reset on restart (single-process deployment)",
        }


def _is_valid_request_id(value: str) -> bool:
    return bool(value) and len(value) <= 64 and all(c.isalnum() or c in "-_" for c in value)


try:
    from starlette.middleware.base import BaseHTTPMiddleware
    from starlette.requests import Request

    # Process-local operational metrics (catalog: monitor_metrics_endpoint,
    # api_usage_analytics). Single-process scope, documented in MetricsRegistry.
    metrics = MetricsRegistry()

    class RequestIDMiddleware(BaseHTTPMiddleware):
        """Assigns/propagates X-Request-ID, emits structured logs, counts ops metrics.

        Reuses an incoming X-Request-ID when well-formed, else generates one.
        No payload data is logged (redaction by construction).
        """

        async def dispatch(self, request: Request, call_next):
            incoming = request.headers.get("x-request-id", "")
            request_id = incoming if _is_valid_request_id(incoming) else uuid.uuid4().hex
            request.state.request_id = request_id
            start = time.perf_counter()
            response = await call_next(request)
            elapsed_ms = (time.perf_counter() - start) * 1000.0
            response.headers["X-Request-ID"] = request_id
            metrics.observe_request(request.url.path, response.status_code)
            logger.info(
                json.dumps(
                    {
                        "event": "http_request",
                        "request_id": request_id,
                        "method": request.method,
                        "path": request.url.path,
                        "status": response.status_code,
                        "elapsed_ms": round(elapsed_ms, 2),
                    }
                )
            )
            return response

except ImportError:  # pragma: no cover - starlette always present in this app
    RequestIDMiddleware = None  # type: ignore[assignment, misc]
    metrics = None  # type: ignore[assignment]
