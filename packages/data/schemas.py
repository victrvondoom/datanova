"""
Unified Pydantic v2 Schemas for AEGIS-Fraud X.
Strictly validated data contracts for ingestion, features, scoring, policy, and audit receipts.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


class ChannelType(str, Enum):
    WEB = "web"
    MOBILE = "mobile"
    POS = "pos"
    ATM = "atm"
    WIRE = "wire"
    P2P = "p2p"


class OperationalAction(str, Enum):
    ALLOW = "ALLOW"
    CHALLENGE = "CHALLENGE"
    REVIEW = "REVIEW"
    BLOCK = "BLOCK"


class DatasetDesignation(str, Enum):
    SYNTHETIC = "SYNTHETIC"
    ULB_CREDIT_CARD = "ULB_CREDIT_CARD"
    PAYSIM = "PAYSIM"
    IEEE_CIS = "IEEE_CIS"
    CUSTOM = "CUSTOM"


class Transaction(BaseModel):
    """Canonical transaction schema across all adapters."""

    transaction_id: str = Field(..., description="Unique transaction identifier")
    timestamp: datetime = Field(..., description="UTC ISO-8601 transaction timestamp")
    sender_id: str = Field(..., description="Originating account / card / user identifier")
    receiver_id: str = Field(..., description="Receiving merchant / account identifier")
    amount: float = Field(..., gt=0, description="Transaction monetary amount")
    currency: str = Field(default="USD", min_length=3, max_length=3)
    channel: ChannelType = Field(default=ChannelType.MOBILE)
    device_id: Optional[str] = Field(default=None, description="Hashed hardware device fingerprint")
    ip_address: Optional[str] = Field(
        default=None, description="Originating IP address or anonymized subnet"
    )
    location: Optional[str] = Field(
        default=None, description="Country/City or geographic coordinate code"
    )
    category: Optional[str] = Field(
        default="retail", description="Merchant category or transfer type"
    )
    is_fraud: Optional[int] = Field(
        default=None, ge=0, le=1, description="Ground truth (0: legit, 1: fraud)"
    )
    dataset_designation: DatasetDesignation = Field(default=DatasetDesignation.SYNTHETIC)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Transaction amount must be strictly positive.")
        return round(v, 2)


class FeatureContribution(BaseModel):
    """Local SHAP feature contribution for explainability."""

    feature_name: str
    feature_value: Any
    shap_value: float
    importance_rank: int


class CostConfiguration(BaseModel):
    """Configurable financial and operational parameters (in USD)."""

    investigation_cost: float = Field(
        default=15.00, ge=0.0, description="Cost to manually investigate 1 alert ($)"
    )
    customer_friction_cost: float = Field(
        default=5.00, ge=0.0, description="Friction cost for legitimate review/challenge ($)"
    )
    friction_block_cost: float = Field(
        default=25.00,
        ge=0.0,
        description="Heavy friction/churn cost if legitimate card is blocked ($)",
    )
    challenge_cost: float = Field(
        default=0.10, ge=0.0, description="Automated SMS/push OTP verification cost ($)"
    )
    challenge_efficiency: float = Field(
        default=0.88,
        ge=0.0,
        le=1.0,
        description="Fraction of challenged fraud successfully stopped",
    )
    investigation_efficiency: float = Field(
        default=0.98, ge=0.0, le=1.0, description="Fraction of reviewed fraud successfully caught"
    )
    max_fpr: float = Field(
        default=0.015,
        ge=0.0,
        le=1.0,
        description="Maximum permitted operational False Positive Rate",
    )
    review_capacity_daily: int = Field(
        default=100, ge=1, description="Maximum manual investigations per day"
    )


class DecisionPolicy(BaseModel):
    """Thresholds determining operational actions based on calibrated probability."""

    policy_name: str = "Cost-Aware-Optimized"
    tau_allow: float = Field(default=0.15, ge=0.0, le=1.0, description="p < tau_allow -> ALLOW")
    tau_review: float = Field(
        default=0.45,
        ge=0.0,
        le=1.0,
        description="tau_allow <= p < tau_review -> CHALLENGE (or REVIEW)",
    )
    tau_block: float = Field(default=0.85, ge=0.0, le=1.0, description="p >= tau_block -> BLOCK")
    use_challenge: bool = True


class PredictionResult(BaseModel):
    """Comprehensive score and operational output for a transaction."""

    transaction_id: str
    calibrated_probability: float = Field(..., ge=0.0, le=1.0)
    raw_score: float
    recommended_action: OperationalAction
    policy_name: str
    model_id: str
    model_version: str
    inference_latency_ms: float
    expected_fraud_loss: float
    expected_cost: float
    top_features: List[FeatureContribution] = Field(default_factory=list)
    audit_receipt_hash: Optional[str] = None
    # Full signed receipt payload. Clients MUST verify this object verbatim;
    # reconstructing a receipt client-side produces a different payload than
    # the one that was signed and will fail HMAC verification.
    audit_receipt: Optional[Dict[str, Any]] = None
    # True when this response is an idempotent replay of a previously stored
    # decision (no side effects were re-applied).
    idempotent_replay: bool = False
    evaluated_at: datetime = Field(default_factory=datetime.utcnow)


class AuditReceipt(BaseModel):
    """Tamper-evident cryptographic receipt for a high-stakes decision."""

    receipt_id: str
    transaction_id: str
    timestamp: datetime
    model_id: str
    model_version: str
    calibrated_probability: float
    recommended_action: OperationalAction
    financial_cost_estimate: float
    top_features: List[FeatureContribution]
    sha256_hash: str
    signature_algorithm: str = "SHA256-HMAC"


class DatasetManifest(BaseModel):
    """Integrity and provenance manifest for a dataset partition."""

    dataset_name: str
    source_url_or_origin: str
    record_count: int
    fraud_count: int
    fraud_prevalence: float
    start_timestamp: Optional[datetime] = None
    end_timestamp: Optional[datetime] = None
    sha256_checksum: str
    split_strategy: str = "StrictChronological_60_20_20"
    train_count: int
    val_count: int
    test_count: int
