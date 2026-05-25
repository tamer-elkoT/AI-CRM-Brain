"""
Data fusion utilities for combining ML predictions with CRM context.
"""

from typing import Dict, Any
from sqlalchemy.orm import Session
from models.schema import ZohoDeal, MLPrediction
import logging

logger = logging.getLogger(__name__)


def fuse_deal_payload(db: Session, prediction: MLPrediction) -> Dict[str, Any]:
    """
    Merges ML prediction with deal context for LLM input.

    Args:
        db: Database session
        prediction: MLPrediction ORM object

    Returns:
        Fused payload dict ready for LLM
    """
    # Fetch the associated deal
    deal = db.query(ZohoDeal).filter(ZohoDeal.id == prediction.deal_id).first()

    if not deal:
        logger.warning(f"Deal {prediction.deal_id} not found for fusion")
        return _create_minimal_payload(prediction)

    # Calculate days to close
    from datetime import datetime

    days_to_close = (
        (deal.closing_date - datetime.now()).days if deal.closing_date else None
    )

    # Build fused payload
    payload = {
        # Identifiers
        "deal_id": deal.id,
        "deal_name": deal.deal_name,
        # ML Prediction
        "base_probability": float(prediction.base_probability),
        "predicted_stage_encoded": prediction.predicted_stage_encoded,
        # Deal Attributes
        "stage": deal.stage,
        "amount": float(deal.amount) if deal.amount else 0.0,
        "closing_date": deal.closing_date.isoformat() if deal.closing_date else None,
        "days_to_close": days_to_close,
        # Account & Owner
        "account_name": deal.account_name or "Unknown",
        "owner_name": deal.owner_name or "Unknown",
        "contact_name": deal.contact_name or "Unknown",
        # Custom Fields (JSONB)
        "custom_fields": deal.custom_fields or {},
        # Feature Vector (for SHAP analysis later)
        "feature_vector": prediction.feature_vector or {},
    }

    return payload


def _create_minimal_payload(prediction: MLPrediction) -> Dict[str, Any]:
    """Fallback payload when deal lookup fails."""
    return {
        "deal_id": prediction.deal_id,
        "deal_name": "Unknown",
        "base_probability": float(prediction.base_probability),
        "predicted_stage_encoded": prediction.predicted_stage_encoded,
        "stage": "Unknown",
        "amount": 0.0,
        "days_to_close": None,
        "account_name": "Unknown",
        "owner_name": "Unknown",
        "custom_fields": {},
        "feature_vector": {},
    }
