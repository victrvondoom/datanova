/**
 * Simulation registry: topic id -> interactive simulation component.
 */
import React from "react";
import { TokenBucketSim, CacheSim, LoadBalancerSim, ReverseProxySim, ApiGatewaySim } from "./Sims01to05";
import { CiCdSim, DockerSim, KubernetesSim, ServiceDiscoverySim, CircuitBreakerSim } from "./Sims06to10";
import { TimeoutSim, RetrySim, BackoffSim, IdempotencySim, QueueSim } from "./Sims11to15";
import { PubSubSim, EdaSim, TwoPCSim, SagaSim, CronSim } from "./Sims16to20";

export type SimProps = { onInteract: () => void };

export const SIM_COMPONENTS: Record<number, React.FC<SimProps>> = {
  1: TokenBucketSim,
  2: CacheSim,
  3: LoadBalancerSim,
  4: ReverseProxySim,
  5: ApiGatewaySim,
  6: CiCdSim,
  7: DockerSim,
  8: KubernetesSim,
  9: ServiceDiscoverySim,
  10: CircuitBreakerSim,
  11: TimeoutSim,
  12: RetrySim,
  13: BackoffSim,
  14: IdempotencySim,
  15: QueueSim,
  16: PubSubSim,
  17: EdaSim,
  18: TwoPCSim,
  19: SagaSim,
  20: CronSim,
};
