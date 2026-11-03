import { useEffect, useRef, useState } from "react";
import { interpolateCountUp } from "./ultra";

/**
 * Animates a number from 0 (or `from`) to `target` once mounted,
 * using requestAnimationFrame and the pure `interpolateCountUp` math.
 * Re-runs when `target` changes so live API refreshes animate, not jump.
 * Respects prefers-reduced-motion by snapping to the target.
 */
export function useCountUp(
  target: number,
  options: { durationMs?: number; from?: number } = {},
): number {
  const { durationMs = 1200, from = 0 } = options;
  const [value, setValue] = useState<number>(from);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  // Keep the latest from/to in refs so the rAF loop reads fresh targets
  // without restarting mid-flight when only the destination changes.
  const fromRef = useRef<number>(from);

  useEffect(() => {
    fromRef.current = value;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setValue(target);
      return;
    }

    const step = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      const next = interpolateCountUp(elapsed, fromRef.current, target, durationMs);
      setValue(next);
      if (elapsed < durationMs) {
        frameRef.current = window.requestAnimationFrame(step);
      } else {
        setValue(target); // settle exactly on the target
        frameRef.current = null;
      }
    };
    startRef.current = null;
    frameRef.current = window.requestAnimationFrame(step);
    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      startRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return value;
}
