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

class DashboardKPIs(BaseModel):
    total_active: int
    high_priority_count: int
    avg_ai_score: float

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

from pydantic import EmailStr

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None
    business_field: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    email: str
    name: Optional[str]
    is_active: bool

class LoginRequest(BaseModel):
    email: str
    password: str

class GoogleLoginRequest(BaseModel):
    credential: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
