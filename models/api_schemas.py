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
