import React from "react";
import { RefreshCw, Radio, WifiOff } from "lucide-react";
import { relativeUpdateLabel, useNow } from "../lib/useLive";

/**
 * Live status chip for the ops views: how fresh is the data on screen?
 * Carries label + icon + color (never color alone — repo UI rule): the icon
 * and the text change together with the color.
 */
export const LiveStatusChip: React.FC<{
  lastUpdatedAt: number | null;
  refreshing?: boolean;
  degraded?: boolean;
  onRefresh?: () => void;
  refreshLabel?: string;
}> = ({ lastUpdatedAt, refreshing = false, degraded = false, onRefresh, refreshLabel = "Refresh now" }) => {
  const now = useNow(1000);
  const label = relativeUpdateLabel(lastUpdatedAt, now);

  if (degraded) {
    return (
      <span className="ultra-chip text-amber-700 dark:text-amber-400 border border-amber-500/30 bg-amber-500/10">
        <WifiOff className="w-3 h-3 shrink-0" aria-hidden="true" />
        <span className="font-semibold">Offline fallback</span>
      </span>
    );
  }

  return (
    <span className="ultra-chip text-zinc-600 dark:text-zinc-300">
      <Radio className={`w-3 h-3 shrink-0 text-emerald-600 dark:text-emerald-400 ${refreshing ? "" : "animate-pulse"}`} aria-hidden="true" />
      <span className="font-semibold">Live</span>
      <span className="text-zinc-500 dark:text-zinc-400">· updated {label}</span>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="ml-1 grid place-items-center rounded-md p-0.5 hover:bg-zinc-200/70 dark:hover:bg-white/10 transition-colors"
          aria-label={refreshLabel}
          title={refreshLabel}
        >
          <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
        </button>
      )}
    </span>
  );
};
