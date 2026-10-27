# AEGIS-Fraud X — Explicit Limitations & Boundary Conditions

In accordance with scientific integrity guidelines, this document explicitly records the engineering boundaries, operational assumptions, and limitations of AEGIS-Fraud X.

---

## 1. Data & Environment Assumptions
1. **Synthetic Data Realism:** While the synthetic generator models realistic Benford's law distributions, burstiness, account velocities, and mule networks, it remains a synthetic surrogate. Benchmarks on synthetic data are clearly marked with `[SYNTHETIC]` tags in all dashboards.
2. **Cold-Start Account Entities:** New accounts with zero transaction history lack graph connectivity. The system gracefully falls back to device- and transaction-level tabular features until degree $\ge 1$.
3. **Delayed Fraud Labels:** In real banking systems, chargebacks and fraud confirmation often lag transaction time by 30 to 90 days. AEGIS-Fraud X includes a drift laboratory simulating this latency, but real-time production feedback loops require operational queues.

## 2. Modeling & Calibration Limitations
1. **Severe Imbalance Calibration:** When fraud prevalence is below 0.1% (e.g. ULB Credit Card dataset with 0.172%), standard Platt scaling can produce over-optimistic probabilities in the extreme tails. We employ Isotonic Regression and Temperature Scaling, calibrated exclusively on validation partitions.
2. **Graph Scale & Latency Tradeoff:** Full multi-hop graph algorithms (e.g., personalized PageRank, dense cycle search) exhibit $O(V + E)$ complexity. For real-time $<20\text{ms}$ SLA budgets, AEGIS-Fraud X bounds graph feature lookups to 2-hop ego-nets within rolling 24-hour temporal windows.
3. **Adversarial Adaptation:** While our drift monitoring lab catches volume and distribution shifts via Population Stability Index (PSI) and Wasserstein Distance, sophisticated organized syndicates continuously modify attack vectors (e.g., transaction smurfing below threshold amounts).

## 3. Financial & Operational Scope
1. **Declared Cost Assumptions:** All financial savings calculations depend directly on declared unit costs ($c_{inv}$, $c_{fric}$, fraud loss recovery rate). These are modeled estimates, not guaranteed bank balance sheet savings.
2. **Human-in-the-Loop Capacity:** If incoming suspicious transaction volume exceeds investigator queue capacity ($K$), policy optimization shifts excess borderline alerts into step-up authentication (e.g., 3DS / SMS OTP) rather than dropping them silently.
