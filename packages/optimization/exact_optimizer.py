"""Exact Constrained Policy Optimizer for AEGIS-Fraud X.

Mathematical formulation
-----------------------
A policy is three thresholds tau_allow <= tau_review <= tau_block that partition
transactions by calibrated probability p into:

    ALLOW     p < tau_allow
    CHALLENGE tau_allow <= p < tau_review
    REVIEW    tau_review <= p < tau_block
    BLOCK     p >= tau_block

Realized cost per transaction (identical semantics to CostEngine.calculate_action_cost):

    ALLOW     fraud: amount            legit: 0
    CHALLENGE fraud: c_auto + (1-eta_ch)*amount   legit: c_auto + 0.3*c_fric
    REVIEW    fraud: c_inv  + (1-eta_rev)*amount  legit: c_inv + c_fric
    BLOCK     fraud: 0                 legit: c_block

Constraints (both evaluated on the fitting data):

    FPR        = (#legit with p >= tau_allow) / n_legit            <= max_fpr
    review_cnt = (#tx with tau_review <= p < tau_block)            <= cap_cnt

Objective: minimize total realized cost over the fitting data.

Completeness argument
---------------------
Every threshold policy corresponds to cutting the sorted transaction list at
*distinct probability values*: tau = u splits {p < u} from {p >= u}, and threshold
policies cannot split tied scores. Conversely, every triple of distinct-value cuts
is realizable by thresholds (tau = u[cut]; the "cut above all values" boundary is
tau = 1.0, valid exactly when no probability equals 1.0). The solver therefore
enumerates ALL realizable policies:

    cut_allow = i, cut_review = j, cut_block = k,  i <= j <= k

over group-aggregated prefix sums, with a sliding-window minimum for the block
cut. Complexity O(m log m) for m distinct values (sorting dominates). This is an
EXACT optimum over the complete feasible policy space — not a grid approximation.

Deterministic tie-breaking: among optimal solutions (within 1e-9), the
lexicographically smallest (i, j, k) is selected (most-permissive allow first).

The returned policy is re-verified against CostEngine with the final thresholds;
if realized metrics violate a constraint, the solver reports INFEASIBLE and never
returns an infeasible policy as successful.
"""

from typing import Any, Dict, Optional, Tuple

import numpy as np

from packages.data.schemas import CostConfiguration, DecisionPolicy
from packages.optimization.cost_engine import CostEngine

_TIE_EPS = 1e-9


class InfeasiblePolicyError(RuntimeError):
    """Raised when no realizable policy satisfies the hard constraints."""


class ExactPolicyOptimizer:
    """Exact solver for the constrained 4-action threshold policy problem."""

    def __init__(self, cost_config: Optional[CostConfiguration] = None):
        self.cost_config = cost_config or CostConfiguration()
        self.cost_engine = CostEngine(self.cost_config)

    # ------------------------------------------------------------------
    # Group aggregation over distinct probability values
    # ------------------------------------------------------------------
    def _build_groups(
        self,
        probs: np.ndarray,
        amounts: np.ndarray,
        labels: np.ndarray,
    ) -> Dict[str, Any]:
        order = np.argsort(probs, kind="stable")
        p = probs[order]
        y = labels[order]
        a = amounts[order]

        unique_vals, group_idx = np.unique(p, return_inverse=True)
        m = len(unique_vals)

        c_auto = self.cost_config.challenge_cost
        eta_ch = self.cost_config.challenge_efficiency
        c_inv = self.cost_config.investigation_cost
        eta_rev = self.cost_config.investigation_efficiency
        c_fric = self.cost_config.customer_friction_cost
        c_block = self.cost_config.friction_block_cost

        fraud_mask = y == 1
        n_g = np.bincount(group_idx, minlength=m).astype(float)
        legit_g = np.bincount(group_idx, weights=(~fraud_mask).astype(float), minlength=m)

        # Per-group realized cost if the whole group receives a given action
        allow_g = np.bincount(
            group_idx, weights=np.where(fraud_mask, a, 0.0), minlength=m
        )
        chal_g = np.bincount(
            group_idx,
            weights=np.where(
                fraud_mask,
                c_auto + (1.0 - eta_ch) * a,
                c_auto + 0.3 * c_fric,
            ),
            minlength=m,
        )
        rev_g = np.bincount(
            group_idx,
            weights=np.where(
                fraud_mask, c_inv + (1.0 - eta_rev) * a, c_inv + c_fric
            ),
            minlength=m,
        )
        blk_g = np.bincount(
            group_idx, weights=np.where(fraud_mask, 0.0, c_block), minlength=m
        )

        return {
            "unique_vals": unique_vals,
            "m": m,
            "n_g": n_g,
            "legit_g": legit_g,
            "allow_g": allow_g,
            "chal_g": chal_g,
            "rev_g": rev_g,
            "blk_g": blk_g,
        }

    # ------------------------------------------------------------------
    # Exact sweep
    # ------------------------------------------------------------------
    def solve(
        self,
        probs: np.ndarray,
        amounts: np.ndarray,
        labels: np.ndarray,
    ) -> Tuple[DecisionPolicy, Dict[str, float]]:
        """Returns (optimal_policy, metrics). Raises InfeasiblePolicyError."""
        probs = np.asarray(probs, dtype=float)
        amounts = np.asarray(amounts, dtype=float)
        labels = np.asarray(labels, dtype=int)
        n = len(probs)
        if n == 0:
            raise InfeasiblePolicyError("Empty fitting population.")

        g = self._build_groups(probs, amounts, labels)
        m = int(g["m"])
        u = g["unique_vals"]
        max_cut = m if (m == 0 or u[-1] < 1.0) else m - 1

        # ---- Constraints -------------------------------------------------
        n_legit = float(g["legit_g"].sum())
        suffix_legit = np.concatenate([np.cumsum(g["legit_g"][::-1])[::-1], [0.0]])
        max_fpr = self.cost_config.max_fpr
        if n_legit > 0:
            allowed_fp = max_fpr * n_legit
            feasible_i = np.nonzero(suffix_legit[: max_cut + 1] <= allowed_fp + 1e-12)[0]
            if feasible_i.size == 0:
                raise InfeasiblePolicyError(
                    "No realizable allow-cut satisfies the FPR constraint."
                )
            i_min = int(feasible_i[0])
        else:
            i_min = 0

        max_review_rate = float(self.cost_config.review_capacity_daily) / max(100.0, float(n))
        cap_cnt = int(np.floor(max_review_rate * n))

        prefix_cnt = np.concatenate([[0.0], np.cumsum(g["n_g"])])  # len m+1

        # Prefix/suffix cost arrays (len m+1)
        PA = np.concatenate([[0.0], np.cumsum(g["allow_g"])])
        PC = np.concatenate([[0.0], np.cumsum(g["chal_g"])])
        PR = np.concatenate([[0.0], np.cumsum(g["rev_g"])])
        SB = np.concatenate([np.cumsum(g["blk_g"][::-1])[::-1], [0.0]])  # SB[k] = block cost groups >= k

        # ---- Range minimum of G(k) = PR[k] + SB[k] over the window ---------
        # For each review cut j, the block cut k ranges over
        #   j <= k <= min(max_cut, kmax(j)),  kmax(j) := largest k with
        #   prefix_cnt[k] - prefix_cnt[j] <= cap_cnt (review-volume constraint).
        # G(k) = PR[k] + SB[k] = review cost of groups [j,k) + block cost [k,m).
        #
        # A sparse-table range-minimum gives O(1) queries with deterministic
        # argmin (smallest k among ties). Note both window edges move
        # monotonically with j, which makes a single-pass deque error-prone;
        # the sparse table avoids that class of bug entirely.
        G = PR + SB  # length m+1

        # kmax(j) via two-pointer (non-increasing in j)
        kmax = np.full(m + 1, -1, dtype=int)
        k = max_cut
        for j in range(0, max_cut + 1):
            if k < j:
                k = j
            while k > j and prefix_cnt[k] - prefix_cnt[j] > cap_cnt + 1e-12:
                k -= 1
            if prefix_cnt[k] - prefix_cnt[j] <= cap_cnt + 1e-12:
                kmax[j] = k

        # Sparse table over G on [0, max_cut]
        width = max_cut + 1
        levels = max(1, int(np.ceil(np.log2(max(width, 1)))) + 1)
        st_val = np.full((levels, width), np.inf)
        st_idx = np.full((levels, width), -1, dtype=int)
        st_val[0] = G[:width]
        st_idx[0] = np.arange(width)
        for lev in range(1, levels):
            span = 1 << (lev - 1)
            for start in range(0, width):
                mid = start + span
                if mid >= width:
                    st_val[lev][start] = st_val[lev - 1][start]
                    st_idx[lev][start] = st_idx[lev - 1][start]
                    continue
                lv, li = st_val[lev - 1][start], st_idx[lev - 1][start]
                rv, ri = st_val[lev - 1][mid], st_idx[lev - 1][mid]
                if rv < lv - _TIE_EPS or (abs(rv - lv) <= _TIE_EPS and ri < li):
                    st_val[lev][start], st_idx[lev][start] = rv, ri
                else:
                    st_val[lev][start], st_idx[lev][start] = lv, li

        def range_min(lo: int, hi: int) -> Tuple[float, int]:
            """Min of G over [lo, hi] with smallest-index tie-break."""
            if lo > hi:
                return np.inf, -1
            length = hi - lo + 1
            lev = int(np.floor(np.log2(length)))
            lv, li = st_val[lev][lo], st_idx[lev][lo]
            rv, ri = st_val[lev][hi - (1 << lev) + 1], st_idx[lev][hi - (1 << lev) + 1]
            if rv < lv - _TIE_EPS or (abs(rv - lv) <= _TIE_EPS and ri < li):
                return float(rv), int(ri)
            return float(lv), int(li)

        M = np.full(m + 1, np.inf)
        best_k = np.full(m + 1, -1, dtype=int)
        for j in range(0, max_cut + 1):
            hi = kmax[j]
            if hi < 0:
                continue  # no feasible block cut for this review cut
            if hi > max_cut:
                hi = max_cut
            M[j], best_k[j] = range_min(j, hi)

        # ---- H(j) and suffix minimum over j >= i --------------------------
        H = PC - PR + M  # length m+1; finite where a valid block cut exists

        S = np.full(m + 1, np.inf)
        best_j = np.full(m + 1, -1, dtype=int)
        cur_min, cur_arg = np.inf, -1
        for j in range(max_cut, -1, -1):
            if np.isfinite(H[j]):
                if cur_arg == -1 or H[j] < cur_min - _TIE_EPS:
                    cur_min, cur_arg = H[j], j
                elif abs(H[j] - cur_min) <= _TIE_EPS:
                    # tie: keep the smaller j (we scan right-to-left)
                    cur_arg = j
            S[j] = cur_min
            best_j[j] = cur_arg

        # ---- Choose allow cut i (smallest i among ties) -------------------
        best_cost = np.inf
        best_i = -1
        for i in range(i_min, max_cut + 1):
            if not np.isfinite(S[i]):
                continue
            cost_i = (PA[i] - PC[i]) + S[i]
            if cost_i < best_cost - _TIE_EPS:
                best_cost, best_i = cost_i, i
            elif abs(cost_i - best_cost) <= _TIE_EPS and best_i != -1:
                # tie: keep the smaller i (already stored)
                pass
        if best_i == -1:
            raise InfeasiblePolicyError(
                "No feasible (i, j, k) policy satisfies the review-capacity constraint."
            )

        j = int(best_j[best_i])
        k = int(best_k[j])

        # ---- Convert cuts to thresholds ------------------------------------
        tau_allow = 1.0 if best_i == m else float(u[best_i])
        tau_review = 1.0 if j == m else float(u[j])
        tau_block = 1.0 if k == m else float(u[k])
        # Thresholds must be non-decreasing; distinct-value cuts guarantee this.
        if not (tau_allow <= tau_review <= tau_block):
            raise InfeasiblePolicyError("Internal error: cut ordering violated.")

        policy = DecisionPolicy(
            policy_name="Cost-Aware-Optimized",
            # Thresholds are NOT rounded: rounding could move a threshold across
            # a distinct probability value and silently change the assignment.
            tau_allow=min(tau_allow, 1.0),
            tau_review=min(tau_review, 1.0),
            tau_block=min(tau_block, 1.0),
            use_challenge=True,
        )

        # ---- Verify realized metrics with the authoritative engine --------
        metrics = self.cost_engine.evaluate_policy_batch(
            calibrated_probs=probs, amounts=amounts, labels=labels, policy=policy
        )
        # Tolerance 1e-4 matches the engine's 5-decimal rounding of the FPR.
        if metrics["false_positive_rate"] > max_fpr + 1e-4:
            raise InfeasiblePolicyError(
                "Verification failed: realized FPR exceeds the constraint."
            )
        realized_review_cnt = metrics["action_counts"]["REVIEW"]
        if realized_review_cnt > cap_cnt:
            raise InfeasiblePolicyError(
                "Verification failed: realized review volume exceeds capacity."
            )
        if abs(float(metrics["total_cost"]) - best_cost) > 0.02:
            raise InfeasiblePolicyError(
                "Verification failed: realized cost disagrees with the enumerated "
                f"optimum (enumerated={best_cost:.4f}, realized={metrics['total_cost']:.2f})."
            )

        metrics["solver"] = "exact-distinct-value-sweep"
        metrics["enumerated_optimal_cost"] = round(float(best_cost), 4)
        metrics["optimization_status"] = "OPTIMAL"
        metrics["cap_review_count"] = cap_cnt
        return policy, metrics
