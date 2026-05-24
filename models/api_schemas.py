from pydantic import BaseModel
from typing import List


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
