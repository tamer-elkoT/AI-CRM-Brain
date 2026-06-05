from pydantic import BaseModel
from typing import List
from typing import Optional


# --- Pydantic Schemas ---
class ZohoDealResponse(BaseModel):
    Deal_ID: str
    Amount: float
    Closing_Date: str
    Owner_Name: str
    Account_Name: str
    # Add other raw Zoho fields here as needed


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

    # These fields will be filled by the **recommendation_data unpacking
    adjusted_probability: float
    recommendation_ar: str
    recommendation_en: Optional[str] = None
    risk_flag: Optional[str] = None

# --- Dashboard & UI Schemas ---
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
    stage: str = "Qualification"
    zoho_probability: float = 0.0
    closing_date: Optional[str] = None
    client_phone: Optional[str] = None
    client_email: Optional[str] = None

from pydantic import EmailStr

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None
    business_field: Optional[str] = None
    role: str = "Sales"             # "Sales" or "Client"
    phone_number: Optional[str] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    business_field: Optional[str] = None
    whatsapp_template: Optional[str] = None
    email_template: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    email: str
    name: Optional[str]
    is_active: bool
    role: str = "Sales"
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
