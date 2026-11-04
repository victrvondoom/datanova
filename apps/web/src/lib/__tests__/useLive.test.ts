import { describe, it, expect } from "vitest";
import { relativeUpdateLabel, formatUptime } from "../useLive";

describe("relativeUpdateLabel", () => {
  it("says connecting while the first fetch is in flight", () => {
    expect(relativeUpdateLabel(null, Date.now())).toBe("connecting…");
  });

  it("reports sub-5-second updates as just now", () => {
    const now = 1_000_000;
    expect(relativeUpdateLabel(now - 4_000, now)).toBe("just now");
    expect(relativeUpdateLabel(now - 500, now)).toBe("just now");
  });

  it("reports seconds, then minutes, then hours, then days", () => {
    const now = 100_000_000;
    expect(relativeUpdateLabel(now - 42_000, now)).toBe("42s ago");
    expect(relativeUpdateLabel(now - 125_000, now)).toBe("2m ago");
    expect(relativeUpdateLabel(now - 7_200_000, now)).toBe("2h ago");
    expect(relativeUpdateLabel(now - 3 * 86_400_000, now)).toBe("3d ago");
  });

  it("never reports a future timestamp as negative", () => {
    const now = 5_000;
    expect(relativeUpdateLabel(now + 10_000, now)).toBe("just now");
  });
});

describe("formatUptime", () => {
  it("formats sub-minute uptimes as seconds", () => {
    expect(formatUptime(45)).toBe("45s");
    expect(formatUptime(0)).toBe("0s");
  });

  it("formats minutes with seconds, hours with minutes", () => {
    expect(formatUptime(61)).toBe("1m 1s");
    expect(formatUptime(3_725)).toBe("1h 2m");
  });

  it("clamps negative input", () => {
    expect(formatUptime(-5)).toBe("0s");
  });
});
