# ai_crm_brain/models/schemas.py
from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, Integer
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

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

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


class LLMRecommendation(Base):
    __tablename__ = "llm_recommendations"

    id = Column(String, primary_key=True)  # Usually a UUID
    deal_id = Column(String, ForeignKey("zoho_deals.id"), nullable=False)
    recommendation_text = Column(String, nullable=False)  # The actual AI advice
    risk_flag = Column(String)  # e.g., "HIGH", "MEDIUM", "LOW"

    # Tracking Sales Rep Interactions (Crucial for MVP)
    rep_action_taken = Column(Boolean, default=False)
    rep_feedback_at = Column(DateTime, nullable=True)
    generated_date = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    deal = relationship("ZohoDeal", back_populates="recommendations")
