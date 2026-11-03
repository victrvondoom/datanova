/**
 * Ultra-mode dynamic primitives — PURE logic only (DOM-free, deterministic).
 * React glue lives in `useCountUp.ts`; behavior lives here and is unit-tested.
 */

/** Exponential-out easing: fast start, gentle settle. Clamps t to [0, 1]. */
export function easeOutExpo(t: number): number {
  const tc = Math.min(1, Math.max(0, t));
  return tc === 1 ? 1 : 1 - Math.pow(2, -10 * tc);
}

/**
 * Interpolated value of a count-up animation at `elapsedMs`.
 * Returns `from` at/below 0 and settles exactly on `to` once the
 * duration has elapsed — the hook renders this every frame.
 */
export function interpolateCountUp(
  elapsedMs: number,
  from: number,
  to: number,
  durationMs = 1200,
): number {
  if (durationMs <= 0) return to;
  const progress = Math.min(1, Math.max(0, elapsedMs / durationMs));
  const eased = easeOutExpo(progress);
  return from + (to - from) * eased;
}

/**
 * Formats a numeric KPI for animated display without jitter:
 * fixed decimals, thousands separators, optional prefix/suffix.
 */
export function formatKpiValue(
  value: number,
  opts: { decimals?: number; prefix?: string; suffix?: string; locale?: string } = {},
): string {
  const { decimals = 0, prefix = "", suffix = "", locale = "en-US" } = opts;
  const formatted = value.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${prefix}${formatted}${suffix}`;
}

/** Derives the stagger delay (ms) for element `index` in an entrance list. */
export function staggerDelayMs(index: number, stepMs = 60): number {
  return Math.max(0, index) * stepMs;
}
