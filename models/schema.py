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
from sqlalchemy import UniqueConstraint


class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=True)  # Null for OAuth users
    name = Column(String(255), nullable=True)
    business_field = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow)
    # --- Role & Phone ---
    role = Column(String(20), nullable=False, default="Sales")  # "Sales" or "Client"
    phone_number = Column(String(30), nullable=True, unique=False)  # with country code
    is_whatsapp_verified = Column(Boolean, default=False)
    # --- Custom outreach templates ---
    whatsapp_template = Column(Text, nullable=True)
    email_template = Column(Text, nullable=True)

class OTPCode(Base):
    """
    Stores one-time passwords for WhatsApp phone verification.
    Each signup generates a new OTP; verified ones are deleted.
    """
    __tablename__ = "otp_codes"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    phone_number = Column(String(30), nullable=False)
    otp_code = Column(String(6), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow)


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
    client_phone = Column(String, nullable=True)
    client_email = Column(String, nullable=True)

    # JSONB is perfect for storing raw API data we might need later
    custom_fields = Column(JSONB)
    is_escalated = Column(Boolean, default=False)

    # --- Sprint 5: Follow-up & Action Tracking ---
    action_status = Column(
        String(30), nullable=True, default="no_action"
    )  # need_action_now, need_action_3days, followed_up, no_action
    followup_days_override = Column(
        Integer, nullable=True, default=3
    )  # Sales rep can customize deferred follow-up period

    # Relationships
    predictions = relationship(
        "MLPrediction", back_populates="deal", cascade="all, delete-orphan"
    )
    recommendations = relationship(
        "LLMRecommendation", back_populates="deal", cascade="all, delete-orphan"
    )
    followups = relationship(
        "DealFollowup", back_populates="deal", cascade="all, delete-orphan"
    )
    followup_logs = relationship(
        "FollowupLog", back_populates="deal", cascade="all, delete-orphan"
    )


class MLPrediction(Base):
    __tablename__ = "ml_predictions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # CRITICAL: Added unique=True so we can use ON CONFLICT(deal_id) DO UPDATE
    deal_id = Column(String, ForeignKey("zoho_deals.id"), nullable=False, unique=True)
    # For generate a recommendation on batchs, we can link multiple predictions to a single batch_id. This allows us to track which predictions were generated together and potentially analyze batch-level performance later on.
    batch_id = Column(UUID(as_uuid=True), nullable=True)
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

    __table_args__ = (UniqueConstraint("deal_id", "batch_id", name="_deal_batch_uc"),)
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
    adjusted_probability = Column(Float, nullable=False)

    # Computed in the DB automatically
    adjusted_score_pct = Column(
        Float,
        Computed(
            "ROUND((adjusted_probability * 100)::numeric, 2)::float", persisted=True
        ),
    )

    base_probability = Column(Float, nullable=True)
    score_delta = Column(
        Float,
        Computed(
            "ROUND(((adjusted_probability - base_probability) * 100)::numeric, 2)::float",
            persisted=True,
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


class DealFollowup(Base):
    """
    Stores follow-up scheduling metadata.
    Created when AI scoring triggers a follow-up (immediate or deferred).
    """
    __tablename__ = "deal_followups"

    id = Column(Integer, primary_key=True, autoincrement=True)
    deal_id = Column(String, ForeignKey("zoho_deals.id", ondelete="CASCADE"), nullable=False)
    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    urgency = Column(String(20), nullable=False)  # 'immediate' or 'deferred'
    followup_days = Column(Integer, default=3)  # Customizable deferred period
    notified_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow)

    # Relationships
    deal = relationship("ZohoDeal", back_populates="followups")


class FollowupLog(Base):
    """
    Records each completed follow-up action by a sales rep.
    """
    __tablename__ = "followup_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    deal_id = Column(String, ForeignKey("zoho_deals.id", ondelete="CASCADE"), nullable=False)
    sales_rep_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    followed_up_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow)
    channel = Column(String(30), default="whatsapp")  # whatsapp, email, phone, etc.
    message_sent = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    # Relationships
    deal = relationship("ZohoDeal", back_populates="followup_logs")


class Notification(Base):
    """
    In-app notifications for sales reps.
    Tracks follow-up alerts, deal updates, score changes, and system messages.
    """
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    deal_id = Column(String, nullable=True)
    type = Column(String(30), nullable=False)  # follow_up_due, deal_updated, score_changed, system
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow)
