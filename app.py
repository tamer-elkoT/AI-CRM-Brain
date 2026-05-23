from fastapi import FastAPI, HTTPException, APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert

# Adjust these imports depending on your exact structural paths for database sessions
from models.database import engine, SessionLocal
from models.schema import ZohoDeal, MLPrediction  # Your SQLAlchemy Model declaration

from models.data_ingestion.zoho_api import fetch_deals_schema
from pydantic import BaseModel
from typing import List
import pandas as pd

# Import the inference functions we just wrote
from models.ml_engine.inference import preprocess_new_deal, predict_batch

from sqlalchemy.sql import func

app = FastAPI(title="AI CRM Brain Pipelines")


# Create an End-Point that fetches deals from Zoho CRM API, preprocesses them, and returns predictions without storing in DB (for testing purposes)
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


# --- API Endpoint ---
@app.post("/api/v1/predict/deals", response_model=List[DealPredictionResponse])
async def predict_deals_endpoint(deals: List[ZohoDealResponse]):
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


# Dependency to get DB session safely
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Create an Endpoint to Run Batch Predictions and Store in DB in ml_predictions table using PostgreSQL UPSERT
@app.post("/api/v1/jobs/run-predictions", tags=["Pipeline Jobs"])
def run_batch_predictions(db: Session = Depends(get_db)):
    """
    Automated Data Pipeline:
    1. Reads raw deals from the `zoho_deals` table.
    2. Runs the ML prediction vectorized batch.
    3. Upserts results into the `ml_predictions` table.
    """
    try:
        # 1. Fetch Deals from the database
        # (In the future, you can filter this to only pull deals where Status == 'Open')
        db_deals = db.query(ZohoDeal).all()

        if not db_deals:
            return {
                "status": "success",
                "message": "No deals found in database to predict.",
            }

        # 2. Convert SQLAlchemy Objects back to Python Dictionaries
        # (This matches the format your preprocess_new_deal function expects)
        raw_deals = []
        for d in db_deals:
            raw_deals.append(
                {
                    "Deal_ID": d.id,  # Or d.deal_id, depending on your ZohoDeal schema
                    "Amount": d.amount,
                    "Closing_Date": str(d.closing_date),
                    "Owner_Name": d.owner_name,
                    "Account_Name": d.account_name,
                    "Stage": d.stage,
                }
            )

        # 3. Preprocess & Predict
        X_processed = preprocess_new_deal(raw_deals)
        ml_results = predict_batch(X_processed)

        # 4. Save to ml_predictions table using PostgreSQL UPSERT
        for raw, res in zip(raw_deals, ml_results):

            # Prepare the insert statement
            stmt = insert(MLPrediction).values(
                deal_id=raw["Deal_ID"],
                predicted_stage_encoded=res["predicted_stage_encoded"],
                base_probability=res["base_probability"],
                confidence_all_classes=res["confidence_all_classes"],
            )

            # If the deal_id already exists, UPDATE the ML scores instead of crashing
            upsert_stmt = stmt.on_conflict_do_update(
                index_elements=["deal_id"],
                set_={
                    "predicted_stage_encoded": stmt.excluded.predicted_stage_encoded,
                    "base_probability": stmt.excluded.base_probability,
                    "confidence_all_classes": stmt.excluded.confidence_all_classes,
                    "updated_at": func.now(),
                },
            )
            db.execute(upsert_stmt)

        # 5. Commit all transactions to the database at once
        db.commit()

        return {
            "status": "success",
            "message": f"Successfully predicted and stored {len(ml_results)} deals.",
            "sample_prediction": ml_results[0] if ml_results else None,
        }

    except Exception as e:
        db.rollback()  # Cancel database changes if an error occurs
        raise HTTPException(
            status_code=500, detail=f"Batch prediction pipeline failed: {str(e)}"
        )
