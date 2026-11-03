import { describe, it, expect } from "vitest";
import {
  easeOutExpo,
  interpolateCountUp,
  formatKpiValue,
  staggerDelayMs,
} from "../ultra";

describe("easeOutExpo", () => {
  it("returns 0 at t=0 and exactly 1 at t=1", () => {
    expect(easeOutExpo(0)).toBe(0);
    expect(easeOutExpo(1)).toBe(1);
  });

  it("clamps out-of-range inputs", () => {
    expect(easeOutExpo(-0.5)).toBe(easeOutExpo(0));
    expect(easeOutExpo(1.7)).toBe(1);
  });

  it("is monotonically non-decreasing", () => {
    let prev = -1;
    for (let t = 0; t <= 1; t += 0.05) {
      const v = easeOutExpo(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe("interpolateCountUp", () => {
  it("starts at `from` and settles exactly on `to`", () => {
    expect(interpolateCountUp(0, 10, 110, 1000)).toBe(10);
    expect(interpolateCountUp(1000, 10, 110, 1000)).toBe(110);
    expect(interpolateCountUp(5000, 10, 110, 1000)).toBe(110);
  });

  it("never overshoots the target", () => {
    for (let ms = 0; ms <= 1200; ms += 60) {
      const v = interpolateCountUp(ms, 0, 100, 1200);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it("snaps immediately when duration is zero", () => {
    expect(interpolateCountUp(0, 0, 42, 0)).toBe(42);
  });

  it("handles decreasing targets", () => {
    expect(interpolateCountUp(0, 100, 40, 500)).toBe(100);
    expect(interpolateCountUp(500, 100, 40, 500)).toBe(40);
  });
});

describe("formatKpiValue", () => {
  it("formats decimals and separators", () => {
    expect(formatKpiValue(31135.123, { decimals: 0 })).toBe("31,135");
    expect(formatKpiValue(0.71471, { decimals: 4 })).toBe("0.7147");
  });

  it("applies prefix and suffix", () => {
    expect(formatKpiValue(71.41, { decimals: 2, suffix: "%" })).toBe("71.41%");
    expect(formatKpiValue(31135, { prefix: "$" })).toBe("$31,135");
  });

  it("pads to minimum fraction digits", () => {
    expect(formatKpiValue(5, { decimals: 2 })).toBe("5.00");
  });
});

describe("staggerDelayMs", () => {
  it("delays linearly by index", () => {
    expect(staggerDelayMs(0)).toBe(0);
    expect(staggerDelayMs(3)).toBe(180);
  });

  it("clamps negative indices to zero", () => {
    expect(staggerDelayMs(-2)).toBe(0);
  });
});
