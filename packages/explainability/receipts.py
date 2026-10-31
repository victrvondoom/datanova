"""
Cryptographically Verifiable Audit Receipts.
Generates immutable, SHA-256 tamper-evident JSON receipts tying predictions to:
- Exact model checkpoint and code version
- Input transaction ID and UTC timestamp
- Calibrated probability and operational action
- Key contributing features
- Cryptographic hash signature
"""

import hashlib
import hmac
import json
from datetime import datetime, timezone
from typing import List, Optional

from packages.data.schemas import AuditReceipt, FeatureContribution, OperationalAction


class AuditReceiptGenerator:
    """Generates and verifies cryptographic audit receipts for financial compliance."""

    def __init__(self, secret_key: str = "aegis_fraud_x_master_audit_salt_2026"):
        self.secret_key = secret_key.encode("utf-8")

    def create_receipt(
        self,
        transaction_id: str,
        model_id: str,
        model_version: str,
        calibrated_probability: float,
        recommended_action: OperationalAction,
        financial_cost_estimate: float,
        top_features: List[FeatureContribution],
        timestamp: Optional[datetime] = None,
    ) -> AuditReceipt:
        """Constructs an auditable receipt and computes its SHA-256 digest."""
        ts = timestamp or datetime.now(timezone.utc)
        receipt_id = f"rcpt_{transaction_id}_{int(ts.timestamp())}"

        action_val = (
            recommended_action.value
            if hasattr(recommended_action, "value")
            else str(recommended_action)
        )

        # Canonical payload string for hashing
        payload = {
            "receipt_id": receipt_id,
            "transaction_id": transaction_id,
            "timestamp": ts.isoformat(),
            "model_id": model_id,
            "model_version": model_version,
            "calibrated_probability": round(calibrated_probability, 5),
            "recommended_action": action_val,
            "cost_estimate": round(financial_cost_estimate, 2),
            "top_features": [f.model_dump() for f in top_features],
        }
        canonical_str = json.dumps(payload, sort_keys=True)
        digest = hmac.new(
            self.secret_key, canonical_str.encode("utf-8"), hashlib.sha256
        ).hexdigest()

        return AuditReceipt(
            receipt_id=receipt_id,
            transaction_id=transaction_id,
            timestamp=ts,
            model_id=model_id,
            model_version=model_version,
            calibrated_probability=round(calibrated_probability, 5),
            recommended_action=recommended_action,
            financial_cost_estimate=round(financial_cost_estimate, 2),
            top_features=top_features,
            sha256_hash=digest,
            signature_algorithm="SHA256-HMAC",
        )

    def verify_receipt(self, receipt: AuditReceipt) -> bool:
        """Verifies that receipt content has not been tampered with."""
        action_val = (
            receipt.recommended_action.value
            if hasattr(receipt.recommended_action, "value")
            else str(receipt.recommended_action)
        )
        ts_str = (
            receipt.timestamp.isoformat()
            if hasattr(receipt.timestamp, "isoformat")
            else str(receipt.timestamp)
        )
        payload = {
            "receipt_id": receipt.receipt_id,
            "transaction_id": receipt.transaction_id,
            "timestamp": ts_str,
            "model_id": receipt.model_id,
            "model_version": receipt.model_version,
            "calibrated_probability": round(receipt.calibrated_probability, 5),
            "recommended_action": action_val,
            "cost_estimate": round(receipt.financial_cost_estimate, 2),
            "top_features": [f.model_dump() for f in receipt.top_features],
        }
        canonical_str = json.dumps(payload, sort_keys=True)
        expected_digest = hmac.new(
            self.secret_key, canonical_str.encode("utf-8"), hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected_digest, receipt.sha256_hash)
