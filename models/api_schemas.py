from pydantic import BaseModel, EmailStr
from typing import List, Literal, Optional
from datetime import date


# ============================================================
# Deal Schemas
# ============================================================

class ZohoDealResponse(BaseModel):
    Deal_ID: str
    Amount: float
    Closing_Date: str
    Owner_Name: str
    Account_Name: str


class DealPredictionResponse(BaseModel):
    Deal_ID: str
    predicted_stage_encoded: int
    base_probability: float
    confidence_all_classes: List[float]


class RecommendationResponse(BaseModel):
    status: str
    message: str
    recommendations_generated: int
    predictions_processed: int
    adjusted_probability: float
    recommendation_ar: str
    recommendation_en: Optional[str] = None
    risk_flag: Optional[str] = None


# ============================================================
# Dashboard & UI Schemas
# ============================================================

class ScatterPoint(BaseModel):
    deal_id: str
    deal_name: str
    amount: float
    ai_score: float
    priority: str


class RankedDeal(BaseModel):
    deal_id: str
    deal_name: str
    account_name: str
    priority: str
    ml_score: float
    ai_score: float
    amount: float
    stage: Optional[str] = None
    closing_date: Optional[str] = None
    client_phone: Optional[str] = None
    client_email: Optional[str] = None
    # Sprint 5: Follow-up & Action fields
    action_status: Optional[str] = "no_action"
    followup_count: int = 0
    last_followup_date: Optional[str] = None
    owner_name: Optional[str] = None
    followup_days_override: Optional[int] = 3


class DashboardKPIs(BaseModel):
    total_active: int
    high_priority_count: int
    avg_ai_score: float


class PaginatedDealsResponse(BaseModel):
    items: List[RankedDeal]
    total: int
    page: int
    page_size: int
    total_pages: int


class DashboardResponse(BaseModel):
    kpis: DashboardKPIs
    scatter_points: List[ScatterPoint]
    ranked_deals: List[RankedDeal]


class AccountRanking(BaseModel):
    account_name: str
    avg_score: float
    deal_count: int


class AccountRankingResponse(BaseModel):
    accounts: List[AccountRanking]


class DealDetailResponse(BaseModel):
    deal_id: str
    deal_name: str
    account_name: str
    stage: str
    amount: float
    closing_date: str
    base_probability: float
    adjusted_probability: float
    recommendation_ar: str
    recommendation_en: Optional[str] = None
    feature_vector: Optional[dict] = None
    risk_flag: Optional[str] = None
    priority_tier: Optional[str] = None
    client_phone: Optional[str] = None
    client_email: Optional[str] = None
    # Sprint 5: Follow-up & Action fields
    action_status: Optional[str] = "no_action"
    followup_count: int = 0
    last_followup_date: Optional[str] = None
    owner_name: Optional[str] = None
    followup_days_override: Optional[int] = 3


class DealCreate(BaseModel):
    deal_name: str
    account_name: Optional[str] = "Unknown"
    contact_name: Optional[str] = "Unknown"
    owner_name: Optional[str] = "Unknown"
    amount: float = 0.0
    # Epic 1: exposed so the UI can prompt for it
    expected_revenue: float = 0.0
    stage: str = "Qualification"
    zoho_probability: float = 0.0
    closing_date: Optional[str] = None
    client_phone: Optional[str] = None
    client_email: Optional[str] = None


# ============================================================
# Auth & User Schemas
# ============================================================

# Epic 1 Multi-Tenant: allowed roles for workspace model
VALID_ROLES = Literal["admin", "manager", "rep"]


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None
    # Epic 3: new fields
    username: Optional[str] = None
    account_name: Optional[str] = None
    business_field: Optional[str] = None
    role: VALID_ROLES = "rep"
    phone_number: Optional[str] = None


class AdminSignupRequest(BaseModel):
    email: EmailStr
    password: str
    company_name: str
    industry: Optional[str] = None
    name: Optional[str] = None
    phone_number: Optional[str] = None


class InviteRequest(BaseModel):
    role: VALID_ROLES
    email: EmailStr


class InviteResponse(BaseModel):
    invite_token: str
    role: str
    email: str
    expires_in: str
    email_status: str = "mocked"  # "sent", "mocked", or "failed"
    email_error: Optional[str] = None


class TeamSignupRequest(BaseModel):
    invite_token: str
    email: EmailStr
    password: str
    name: Optional[str] = None
    phone_number: Optional[str] = None


class UserUpdate(BaseModel):
    """Used by PATCH /api/v1/auth/users/me"""
    name: Optional[str] = None
    username: Optional[str] = None
    account_name: Optional[str] = None
    business_field: Optional[str] = None
    phone_number: Optional[str] = None
    whatsapp_template: Optional[str] = None
    email_template: Optional[str] = None


class UserResponse(BaseModel):
    id: str
    email: str
    company_id: Optional[str] = None
    company_name: Optional[str] = None  # Epic 1.3: from Company relation
    name: Optional[str] = None
    # Epic 3: new profile fields
    username: Optional[str] = None
    account_name: Optional[str] = None
    business_field: Optional[str] = None
    is_active: bool
    role: str = "rep"
    phone_number: Optional[str] = None
    is_whatsapp_verified: bool = False
    whatsapp_template: Optional[str] = None
    email_template: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleLoginRequest(BaseModel):
    credential: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str


class OTPVerifyRequest(BaseModel):
    phone_number: str
    otp_code: str


class SignupPendingResponse(BaseModel):
    """Returned from POST /signup — user created but not yet verified."""
    status: str
    message: str
    phone_number: str   # echoed back so the OTP modal knows which phone


# ============================================================
# Sprint 5: Follow-up, Notifications, Stage Editing Schemas
# ============================================================

class FollowupMarkRequest(BaseModel):
    """Request body when marking a deal as followed up."""
    channel: str = "whatsapp"
    message_sent: Optional[str] = None
    notes: Optional[str] = None


class FollowupDaysUpdateRequest(BaseModel):
    """Request body for updating the deferred follow-up period."""
    days: int = 3  # Number of days for deferred follow-up


class GenerateMessageRequest(BaseModel):
    """Optional context overrides for Grok message generation."""
    sales_rep_name: Optional[str] = None


class GenerateMessageResponse(BaseModel):
    status: str
    generated_message: str
    deal_name: str
    account_name: str
    client_phone: Optional[str] = None


class NotificationResponse(BaseModel):
    id: int
    user_id: str
    deal_id: Optional[str] = None
    type: str
    title: str
    body: str
    is_read: bool = False
    created_at: str


class NotificationListResponse(BaseModel):
    items: List[NotificationResponse]
    unread_count: int
    total: int


class StageUpdateRequest(BaseModel):
    new_stage: str


# ============================================================
# Epic 2: Analytics Schemas
# ============================================================

class LeaderboardEntry(BaseModel):
    """Performance stats for one sales rep (shown to managers only)."""
    rep_name: str
    closed_deals: int
    followup_count: int
    avg_ai_score: float


class AnalyticsPeriod(BaseModel):
    start: str
    end: str


class AnalyticsResponse(BaseModel):
    period: AnalyticsPeriod
    active_deals: int
    closed_deals: int
    total_followups: int
    # Only included when the requesting user is a sales_manager
    leaderboard: Optional[List[LeaderboardEntry]] = None


# ============================================================
# Analytics Pipeline Schemas (new endpoint)
# ============================================================

class StageBreakdown(BaseModel):
    """Deal count and total value for a single pipeline stage."""
    stage: str
    deal_count: int
    total_amount: float
    pct_of_pipeline: float   # 0-100, relative to total active pipeline value


class TopDealEntry(BaseModel):
    """A deal record for the Highest Value Deals table."""
    deal_id: str
    deal_name: str
    account_name: str
    stage: str
    amount: float


class PipelineAnalyticsResponse(BaseModel):
    """
    Full analytics payload for the Analytics Dashboard.
    Includes KPIs + stage breakdown + top deals.
    """
    # KPI cards
    active_pipeline_value: float       # SUM amount for non-closed deals
    total_won_amount: float            # SUM amount for Closed Won deals
    win_rate_pct: float                # closed_won / (closed_won + closed_lost) * 100
    at_risk_value: float               # SUM amount where action_status = need_action_now
    at_risk_deal_count: int            # COUNT of at-risk deals
    closed_won_count: int
    closed_lost_count: int
    other_stalled_count: int           # neither won nor lost (active stalled)
    # Stage funnel
    stage_breakdown: List[StageBreakdown]
    # Bottom tables
    top_deals: List[TopDealEntry]      # top 5 by amount (any active stage)

