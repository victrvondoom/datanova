import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Live-data plumbing for the ops dashboard.
 *
 * Pure helpers are DOM-free and unit-tested (`__tests__/useLive.test.ts`);
 * hooks follow the trail/lab convention: behavior in lib, components render.
 */

/** "just now" / "12s ago" / "3m ago" — for a live status chip. */
export function relativeUpdateLabel(lastUpdatedAt: number | null, nowMs: number): string {
  if (lastUpdatedAt === null) return "connecting…";
  const seconds = Math.max(0, Math.round((nowMs - lastUpdatedAt) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** 61 -> "1m 1s"; 3725 -> "1h 2m"; 45 -> "45s" — uptime from seconds. */
export function formatUptime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

/** Re-renders the caller on a cadence with the current epoch ms. Stops when hidden. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") setNow(Date.now());
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export interface LiveState<T> {
  data: T | null;
  lastUpdatedAt: number | null;
  refreshing: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Fetch on mount, poll on `intervalMs`, and refetch when the window regains
 * focus or becomes visible again. Never clobbers state after unmount.
 */
export function useLive<T>(fetcher: () => Promise<T>, intervalMs: number): LiveState<T> {
  const [data, setData] = useState<T | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Keep the latest fetcher in a ref so a new closure identity (inline arrow
  // in a component body) never restarts the polling loop. Updated in an
  // effect, never during render.
  const fetcherRef = useRef(fetcher);
  const mountedRef = useRef(true);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await fetcherRef.current();
      if (!mountedRef.current) return;
      setData(result);
      setLastUpdatedAt(Date.now());
      setError(null);
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (mountedRef.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // Deferred off the render commit (avoids cascading setState in the
    // effect body) — the same convention the ops views already use.
    const kick = window.setTimeout(() => void refresh(), 0);
    const id = window.setInterval(() => void refresh(), intervalMs);
    const onFocus = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      mountedRef.current = false;
      window.clearTimeout(kick);
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [intervalMs, refresh]);

  return { data, lastUpdatedAt, refreshing, error, refresh };
}
