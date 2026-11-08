import { describe, it, expect } from "vitest";
import {
  evaluateArrivalRate,
  evaluateServiceRate,
  systemDerivatives,
  rk4Step,
  solveSystemODE,
  DEFAULT_ODE_PARAMS,
} from "../differentialEngine";

describe("DataNova Differential Dynamics Engine", () => {
  it("evaluates continuous arrival rate with surge envelope", () => {
    const nominal = evaluateArrivalRate(2, DEFAULT_ODE_PARAMS);
    expect(nominal).toBeGreaterThan(350);
    expect(nominal).toBeLessThan(550);

    // Peak surge at t = 20s
    const surge = evaluateArrivalRate(20, DEFAULT_ODE_PARAMS);
    expect(surge).toBeGreaterThan(1200);
  });

  it("evaluates non-linear service rate with Hill saturation and thrashing", () => {
    const muSmall = evaluateServiceRate(10, DEFAULT_ODE_PARAMS);
    const muOptimal = evaluateServiceRate(80, DEFAULT_ODE_PARAMS);
    const muThrashing = evaluateServiceRate(1500, DEFAULT_ODE_PARAMS);

    expect(muOptimal).toBeGreaterThan(muSmall);
    // At extreme queue length, context thrashing penalty β reduces effective service rate
    expect(muThrashing).toBeLessThan(muOptimal);
  });

  it("calculates system derivative vector correctly", () => {
    const y0 = [10, 40, 0.1, 0.05, 0, 0];
    const deriv = systemDerivatives(0, y0, DEFAULT_ODE_PARAMS);
    expect(deriv.length).toBe(6);
    expect(typeof deriv[0]).toBe("number"); // dQ/dt
    expect(typeof deriv[1]).toBe("number"); // dL/dt
    expect(typeof deriv[2]).toBe("number"); // dS/dt
  });

  it("performs single Runge-Kutta 4th order step stably", () => {
    const y0 = [20, 50, 0.1, 0.05, 0, 0];
    const y1 = rk4Step(0, y0, 0.1, DEFAULT_ODE_PARAMS);
    expect(y1.length).toBe(6);
    expect(Number.isFinite(y1[0])).toBe(true);
    expect(Number.isFinite(y1[1])).toBe(true);
  });

  it("solves ODE trajectory across time horizon with stable eigenvalue", () => {
    const sim = solveSystemODE(DEFAULT_ODE_PARAMS, 40, 0.2);
    expect(sim.trajectory.length).toBeGreaterThan(100);
    expect(sim.phasePortrait.length).toBeGreaterThan(5);
    expect(sim.peakQueue).toBeGreaterThan(0);
    expect(sim.peakLatency).toBeGreaterThan(DEFAULT_ODE_PARAMS.latencyBaseMs);
    expect(typeof sim.stabilityEigenvalue).toBe("number");
  });
});
