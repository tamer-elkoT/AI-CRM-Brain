# ai_crm_brain/models/schemas.py
from sqlalchemy import (
    Column,
    String,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    Integer,
    Numeric,
    Computed,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
import datetime
from models.database import Base
import uuid


class ZohoDeal(Base):
    __tablename__ = "zoho_deals"

    # Zoho uses large numerical IDs, so we store them as Strings to be safe
    id = Column(String, primary_key=True, index=True)
    deal_name = Column(String, nullable=False)
    stage = Column(String, nullable=False)
    amount = Column(Float, default=0.0)
    closing_date = Column(DateTime)
    account_name = Column(String, nullable=True)
    zoho_probability = Column(Float)
    expected_revenue = Column(Float, default=0.0)
    contact_name = Column(String)
    owner_name = Column(String)

    # JSONB is perfect for storing raw API data we might need later
    custom_fields = Column(JSONB)

    # Relationships
    predictions = relationship(
        "MLPrediction", back_populates="deal", cascade="all, delete-orphan"
    )
    recommendations = relationship(
        "LLMRecommendation", back_populates="deal", cascade="all, delete-orphan"
    )


class MLPrediction(Base):
    __tablename__ = "ml_predictions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # CRITICAL: Added unique=True so we can use ON CONFLICT(deal_id) DO UPDATE
    deal_id = Column(String, ForeignKey("zoho_deals.id"), nullable=False, unique=True)

    # --- ML Outputs ---
    predicted_stage_encoded = Column(Integer, nullable=True)  # e.g., 3 for "Won"
    base_probability = Column(Float, nullable=False)  # e.g., 92.84
    confidence_all_classes = Column(
        JSONB, nullable=True
    )  # Array of all 4 probabilities
    feature_vector = Column(JSONB, nullable=True)  # For SHAP / LLM Context in Sprint 4

    # Automatically updates the timestamp whenever the prediction changes
    prediction_date = Column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow
    )
    updated_at = Column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow
    )
    # Relationships
    deal = relationship("ZohoDeal", back_populates="predictions")
    llm_recommendation = relationship(
        "LLMRecommendation", back_populates="prediction", uselist=False
    )


class LLMRecommendation(Base):
    __tablename__ = "llm_recommendations"

    # --- Primary Key ---
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # --- Foreign Keys ---
    deal_id = Column(
        String(64), ForeignKey("zoho_deals.id", ondelete="CASCADE"), nullable=False
    )
    prediction_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ml_predictions.id", ondelete="SET NULL"),
        nullable=True,
    )

    # --- LLM Input Context ---
    # Stores exactly what you sent to Claude so you can debug hallucinations
    llm_payload = Column(JSONB, nullable=False)

    # --- LLM Output & Scores ---
    adjusted_probability = Column(Numeric(5, 4), nullable=False)

    # Computed in the DB automatically
    adjusted_score_pct = Column(
        Numeric(5, 2), Computed("ROUND(adjusted_probability * 100, 2)", persisted=True)
    )

    base_probability = Column(Numeric(5, 4), nullable=True)
    score_delta = Column(
        Numeric(5, 2),
        Computed(
            "ROUND((adjusted_probability - base_probability) * 100, 2)", persisted=True
        ),
    )

    # --- Natural Language Recommendations ---
    recommendation_ar = Column(Text, nullable=False)
    recommendation_en = Column(Text, nullable=True)

    # --- Tiers & Risks ---
    priority_tier = Column(
        String(10),
        Computed(
            "CASE WHEN adjusted_probability >= 0.75 THEN 'HIGH' WHEN adjusted_probability >= 0.45 THEN 'MEDIUM' ELSE 'LOW' END",
            persisted=True,
        ),
    )
    risk_flag = Column(String(20), nullable=True)
    risk_reasoning = Column(Text, nullable=True)

    # --- LLM Provenance (Crucial for MLOps) ---
    llm_model_id = Column(String(64), nullable=False)  # e.g., "claude-3-5-sonnet"
    prompt_version = Column(String(16), nullable=False)  # e.g., "v1.2"
    llm_latency_ms = Column(Integer, nullable=True)
    llm_tokens_used = Column(Integer, nullable=True)

    # --- Batch Tracking ---
    batch_id = Column(UUID(as_uuid=True), nullable=True)
    generated_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow)

    # --- Sales Rep Feedback Loop (For Streamlit UI) ---
    rep_action_taken = Column(Boolean, default=None, nullable=True)
    rep_feedback_at = Column(DateTime(timezone=True), nullable=True)
    rep_feedback_text = Column(Text, nullable=True)

    # --- Audit ---
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow)
    updated_at = Column(
        DateTime(timezone=True),
        default=datetime.datetime.utcnow,
        onupdate=datetime.datetime.utcnow,
    )

    # --- Relationships ---
    deal = relationship("ZohoDeal", back_populates="recommendations")
    # Uncomment if you have the MLPrediction model defined:
    prediction = relationship("MLPrediction", back_populates="llm_recommendation")
