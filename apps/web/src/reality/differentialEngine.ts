/**
 * DataNova Differential Dynamics Engine
 *
 * Continuous differential equations and numerical integration (Runge-Kutta 4th Order)
 * modeling microservice queue dynamics, latency diffusion drift, cascading saturation,
 * and closed-loop PID autoscaling on architecture graphs.
 *
 * Mathematical Foundations:
 * 1. Fluid-Flow Queue Dynamics:
 *    dQ/dt = λ(t) - μ_max * (Q^m / (K^m + Q^m)) * exp(-β * Q)
 * 2. Latency Diffusion Drift (Relaxation ODE):
 *    dL/dt = (1/τ) * (L_0 + Q / μ_eff - L) + κ * max(0, dQ/dt)
 * 3. Coupled Cascading Saturation ODE on Graph Adjacency:
 *    dS_i/dt = η_i * (Q_i / C_i) - γ_i * S_i + sum_j [ A_ji * θ_ji * S_j * (1 - S_i) ]
 * 4. Closed-Loop Controller Dynamics (2nd-Order Damped Oscillator):
 *    d²C/dt² + 2ζω_n dC/dt + ω_n² (C - C_0) = K_p * de/dt + K_i * e
 */

export interface SystemODEParams {
  lambdaNominal: number;      // Nominal arrival rate (req/s)
  lambdaSurge: number;        // Surge arrival amplitude (req/s)
  surgeStartTime: number;     // Time surge begins (seconds)
  surgeDuration: number;      // Duration of surge (seconds)
  muMax: number;              // Max service capacity (req/s)
  halfSaturationK: number;    // Half-saturation queue constant K
  thrashingBeta: number;      // Context switch / lock contention penalty (1/req)
  latencyTau: number;         // Latency relaxation time constant (s)
  latencyBaseMs: number;      // Baseline processing latency (ms)
  cascadeAlpha: number;       // Cross-service failure propagation coupling
  recoveryGamma: number;      // Service auto-recovery / circuit-break rate
  dampingZeta: number;        // Autoscaler damping ratio ζ
  naturalFreqOmega: number;   // Autoscaler natural frequency ω_n
}

export const DEFAULT_ODE_PARAMS: SystemODEParams = {
  lambdaNominal: 450,
  lambdaSurge: 1200,
  surgeStartTime: 10,
  surgeDuration: 25,
  muMax: 1100,
  halfSaturationK: 80,
  thrashingBeta: 0.0018,
  latencyTau: 1.4,
  latencyBaseMs: 35,
  cascadeAlpha: 0.38,
  recoveryGamma: 0.42,
  dampingZeta: 0.72,
  naturalFreqOmega: 0.45,
};

export interface ODETrajectoryPoint {
  t: number;               // time in seconds
  lambda: number;          // arrival rate λ(t)
  queue: number;           // queue length Q(t)
  dQueueDt: number;        // dQ/dt rate of change
  serviceRate: number;     // effective service rate μ(Q)
  latencyP95: number;      // p95 latency L(t) in ms
  saturationRatio: number; // system saturation percentage S(t) ∈ [0, 1]
  cascadeNodeSaturation: number; // downstream dependent service saturation
  autoscaledCapacity: number;    // dynamic autoscaled instances / capacity
}

export interface PhaseVector {
  q: number;
  dqDt: number;
  normalizedVectorX: number;
  normalizedVectorY: number;
}

export interface ODESimulationResult {
  params: SystemODEParams;
  trajectory: ODETrajectoryPoint[];
  phasePortrait: PhaseVector[];
  stabilityEigenvalue: number; // Real part of Jacobian eigenvalue at equilibrium (negative => stable)
  peakQueue: number;
  peakLatency: number;
  recoveryTimeSeconds: number;
  isCongestionCollapsed: boolean;
}

/**
 * Arrival rate function λ(t) with continuous sinusoidal variation and Heaviside surge pulse
 */
export function evaluateArrivalRate(t: number, params: SystemODEParams): number {
  const base = params.lambdaNominal + 40 * Math.sin(0.4 * t);
  const inSurge = t >= params.surgeStartTime && t <= (params.surgeStartTime + params.surgeDuration);
  if (!inSurge) return Math.max(10, base);

  // Smooth sigmoid envelope for the surge onset and decay
  const tRel = t - params.surgeStartTime;
  const tEndRel = (params.surgeStartTime + params.surgeDuration) - t;
  const attack = 1 / (1 + Math.exp(-2.5 * tRel));
  const decay = 1 / (1 + Math.exp(-2.5 * tEndRel));
  const envelope = attack * decay;

  return Math.max(10, base + params.lambdaSurge * envelope);
}

/**
 * Effective non-linear service rate μ(Q) with thrashing penalty
 */
export function evaluateServiceRate(queue: number, params: SystemODEParams): number {
  const q = Math.max(0, queue);
  const m = 2; // Hill coefficient
  const qPow = Math.pow(q, m);
  const kPow = Math.pow(params.halfSaturationK, m);
  const saturationFactor = qPow / (kPow + qPow + 1e-6);
  const thrashing = Math.exp(-params.thrashingBeta * q);
  return params.muMax * saturationFactor * thrashing;
}

/**
 * System derivative vector F(t, y) for numerical integration:
 * State vector y = [
 *   0: Q (Queue length),
 *   1: L (Latency ms),
 *   2: S (Primary saturation [0, 1]),
 *   3: S_downstream (Cascading saturation [0, 1]),
 *   4: C (Capacity offset),
 *   5: dC/dt (Capacity velocity)
 * ]
 */
export function systemDerivatives(
  t: number,
  y: number[],
  params: SystemODEParams
): number[] {
  const queue = Math.max(0, y[0]);
  const latency = Math.max(params.latencyBaseMs, y[1]);
  const sPrimary = Math.min(1, Math.max(0, y[2]));
  const sDownstream = Math.min(1, Math.max(0, y[3]));
  const capOffset = y[4];
  const capVelocity = y[5];

  const lambda = evaluateArrivalRate(t, params);
  const effectiveCapacity = params.muMax + capOffset;
  const mu = Math.max(10, evaluateServiceRate(queue, { ...params, muMax: effectiveCapacity }));

  // 1. dQ/dt = λ - μ (when Q > 0 or λ >= μ)
  let dQdt = lambda - mu;
  if (queue <= 0 && dQdt < 0) {
    dQdt = 0;
  }

  // 2. dL/dt = (1/τ) * (L_0 + (Q / μ)*1000 - L) + κ * max(0, dQ/dt)
  const targetLatency = params.latencyBaseMs + (queue / Math.max(100, mu)) * 1000;
  const dLdt = (1 / params.latencyTau) * (targetLatency - latency) + 0.15 * Math.max(0, dQdt);

  // 3. dS/dt = η * (Q / K) - γ * S
  const dSdt = 0.25 * (queue / (params.halfSaturationK * 2)) - params.recoveryGamma * sPrimary;

  // 4. Downstream cascading saturation ODE:
  //    dS_down/dt = α * S_primary * (1 - S_down) - γ_down * S_down
  const dSDownDt = params.cascadeAlpha * sPrimary * (1 - sDownstream) - (params.recoveryGamma * 0.85) * sDownstream;

  // 5 & 6. 2nd order autoscaler ODE:
  //    d²C/dt² + 2ζω dC/dt + ω² C = K_p * (latency - SLA)
  const latencyError = Math.max(0, latency - 120);
  const d2Cdt2 = 2.4 * latencyError - 2 * params.dampingZeta * params.naturalFreqOmega * capVelocity - Math.pow(params.naturalFreqOmega, 2) * capOffset;

  return [dQdt, dLdt, dSdt, dSDownDt, capVelocity, d2Cdt2];
}

/**
 * Classical Runge-Kutta 4th-Order (RK4) Integrator
 */
export function rk4Step(
  t: number,
  y: number[],
  dt: number,
  params: SystemODEParams
): number[] {
  const k1 = systemDerivatives(t, y, params);

  const y2 = y.map((val, i) => val + 0.5 * dt * k1[i]);
  const k2 = systemDerivatives(t + 0.5 * dt, y2, params);

  const y3 = y.map((val, i) => val + 0.5 * dt * k2[i]);
  const k3 = systemDerivatives(t + 0.5 * dt, y3, params);

  const y4 = y.map((val, i) => val + dt * k3[i]);
  const k4 = systemDerivatives(t + dt, y4, params);

  return y.map((val, i) => val + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

/**
 * Solve system differential equations across time horizon [0, tMax]
 */
export function solveSystemODE(
  params: SystemODEParams = DEFAULT_ODE_PARAMS,
  tMax: number = 60,
  dt: number = 0.2
): ODESimulationResult {
  const steps = Math.ceil(tMax / dt);
  const trajectory: ODETrajectoryPoint[] = [];

  // Initial state vector y_0: [Q, L, S_primary, S_downstream, C, dC/dt]
  let y = [12, params.latencyBaseMs + 8, 0.05, 0.02, 0, 0];
  let peakQueue = 0;
  let peakLatency = 0;
  let surgeEnded = false;
  let recoveredAt = -1;

  for (let step = 0; step <= steps; step++) {
    const t = step * dt;
    const lambda = evaluateArrivalRate(t, params);
    const effectiveCap = params.muMax + y[4];
    const mu = evaluateServiceRate(y[0], { ...params, muMax: effectiveCap });
    const dQdt = lambda - mu;

    const q = Math.max(0, y[0]);
    const lat = Math.max(params.latencyBaseMs, y[1]);
    const s1 = Math.min(1, Math.max(0, y[2]));
    const sDown = Math.min(1, Math.max(0, y[3]));

    if (q > peakQueue) peakQueue = q;
    if (lat > peakLatency) peakLatency = lat;

    if (t > params.surgeStartTime + params.surgeDuration) {
      surgeEnded = true;
      if (recoveredAt < 0 && q < 25 && lat < params.latencyBaseMs + 30) {
        recoveredAt = t;
      }
    }

    trajectory.push({
      t: Math.round(t * 10) / 10,
      lambda: Math.round(lambda),
      queue: Math.round(q * 10) / 10,
      dQueueDt: Math.round(dQdt * 10) / 10,
      serviceRate: Math.round(mu),
      latencyP95: Math.round(lat),
      saturationRatio: Math.round(s1 * 100) / 100,
      cascadeNodeSaturation: Math.round(sDown * 100) / 100,
      autoscaledCapacity: Math.round(effectiveCap),
    });

    // Advance RK4 step
    y = rk4Step(t, y, dt, params);
  }

  // Generate 2D Phase Portrait Grid (dQ/dt vs Q)
  const phasePortrait: PhaseVector[] = [];
  const qTestVals = [5, 25, 50, 100, 175, 250, 350, 500];
  for (const qVal of qTestVals) {
    const muVal = evaluateServiceRate(qVal, params);
    const nominalDq = params.lambdaNominal - muVal;
    const mag = Math.sqrt(1 + nominalDq * nominalDq);
    phasePortrait.push({
      q: qVal,
      dqDt: nominalDq,
      normalizedVectorX: 1 / mag,
      normalizedVectorY: nominalDq / mag,
    });
  }

  // Calculate Jacobian stability eigenvalue: d(dQ/dt)/dQ = - dμ/dQ
  const eps = 1.0;
  const muAtEq = evaluateServiceRate(params.halfSaturationK, params);
  const muAtEqPlus = evaluateServiceRate(params.halfSaturationK + eps, params);
  const dMuDq = (muAtEqPlus - muAtEq) / eps;
  const stabilityEigenvalue = -dMuDq; // negative => asymptotically stable

  const recoveryTimeSeconds = recoveredAt > 0
    ? Math.round((recoveredAt - (params.surgeStartTime + params.surgeDuration)) * 10) / 10
    : (surgeEnded ? 999 : 0);

  const isCongestionCollapsed = peakQueue > 280 && recoveryTimeSeconds > 20;

  return {
    params,
    trajectory,
    phasePortrait,
    stabilityEigenvalue: Math.round(stabilityEigenvalue * 1000) / 1000,
    peakQueue: Math.round(peakQueue),
    peakLatency: Math.round(peakLatency),
    recoveryTimeSeconds,
    isCongestionCollapsed,
  };
}
