from fastapi import FastAPI, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert

# Adjust these imports depending on your exact structural paths for database sessions
from models.database import engine, SessionLocal
from models.schema import ZohoDeal  # Your SQLAlchemy Model declaration

from models.data_ingestion.zoho_api import fetch_deals_schema
from pydantic import BaseModel
from typing import List
import pandas as pd

# Import the inference functions we just wrote
from models.ml_engine.inference import preprocess_new_deal, predict_batch

app = FastAPI(title="AI CRM Brain Pipelines")


@app.post("/api/v1/ingest/deals", tags=["Ingestion Pipeline"])
def ingest_zoho_deals():
    """
    Automated Data Pipeline:
    1. Fetches real-time records from Zoho CRM API.
    2. Transforms/Flattens nested JSON structures into target database formatting.
    3. Executes high-performance database upserts (Insert or Update on conflict) directly to PostgreSQL.
    """
    db: Session = SessionLocal()
    try:
        # 1. Fetch raw array
        raw_deals = fetch_deals_schema()
        if not raw_deals:
            return {
                "status": "success",
                "message": "Pipeline run complete. No active records found in Zoho.",
            }

        records_processed = 0

        # 2. Iterate and Transform
        for deal in raw_deals:
            # Flattening and variable sanitation structure logic
            flattened_record = {
                "id": deal.get("id"),  # Maps Deal ID directly
                "deal_name": deal.get("Deal_Name"),
                "amount": float(deal.get("Amount")) if deal.get("Amount") else 0.0,
                "expected_revenue": (
                    float(deal.get("Expected_Revenue"))
                    if deal.get("Expected_Revenue")
                    else 0.0
                ),
                "zoho_probability": (
                    float(deal.get("Probability")) if deal.get("Probability") else 0.0
                ),
                "stage": deal.get("Stage"),
                "closing_date": deal.get("Closing_Date"),
                "account_name": (
                    deal.get("Account_Name", {}).get("name")
                    if deal.get("Account_Name")
                    else "Unknown"
                ),
                "contact_name": (
                    deal.get("Contact_Name", {}).get("name")
                    if deal.get("Contact_Name")
                    else "Unknown"
                ),
                "owner_name": (
                    deal.get("Owner", {}).get("name")
                    if deal.get("Owner")
                    else "Unknown"
                ),
            }

            # 3. High-Performance PostgreSQL Upsert (ON CONFLICT DO UPDATE)
            # This ensures that if the deal already exists, it updates it, keeping your DB clean!
            stmt = insert(ZohoDeal).values(**flattened_record)

            # Update columns if the primary key 'id' conflicts
            update_dict = {c.name: c for c in stmt.excluded if c.name != "id"}
            upsert_stmt = stmt.on_conflict_do_update(
                index_elements=["id"], set_=update_dict
            )

            db.execute(upsert_stmt)
            records_processed += 1

        # Commit the transaction to save changes permanently
        db.commit()

        return {
            "status": "success",
            "message": f"Pipeline successfully automated. Synced {records_processed} deals directly to PostgreSQL.",
            "source": "Zoho CRM REST API v3",
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Pipeline execution broke: {str(e)}"
        )

    finally:
        db.close()


# --- Pydantic Schemas ---
class ZohoDeal(BaseModel):
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


# --- API Endpoint ---
@app.post("/api/v1/predict/deals", response_model=List[DealPredictionResponse])
async def predict_deals_endpoint(deals: List[ZohoDeal]):
    """
    Receives a batch of raw Zoho Deals, preprocesses them, and returns closure probabilities.
    """
    try:
        # 1. Convert Pydantic models to dicts
        raw_deals = [deal.dict() for deal in deals]

        # 2. Preprocess (Vectorized)
        X_processed = preprocess_new_deal(raw_deals)

        # 3. Predict (Vectorized)
        ml_results = predict_batch(X_processed)

        # 4. Attach Deal_IDs back to the results for the response
        final_response = []
        for raw, res in zip(raw_deals, ml_results):
            final_response.append(
                DealPredictionResponse(
                    Deal_ID=raw["Deal_ID"],
                    predicted_stage_encoded=res["predicted_stage_encoded"],
                    base_probability=res["base_probability"],
                    confidence_all_classes=res["confidence_all_classes"],
                )
            )

        return final_response

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}")
