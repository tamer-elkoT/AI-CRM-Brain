import uuid

from fastapi import FastAPI, HTTPException, APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.sql import func
from typing import List

from models.database import engine, SessionLocal
from models.schema import ZohoDeal, MLPrediction
from models.api_schemas import ZohoDealResponse, DealPredictionResponse

from models.ml_engine.inference import preprocess_new_deal, predict_batch

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/predict/deals", response_model=List[DealPredictionResponse])
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


@router.post("/jobs/run-predictions")
def run_batch_predictions(
    batch_id: str = None,  # 1. Allow the user to pass a batch_id via query parameter
    db: Session = Depends(get_db),
):
    """
    Automated Data Pipeline:
    1. Reads raw deals from the `zoho_deals` table.
    2. Runs the ML prediction vectorized batch.
    3. Upserts results into the `ml_predictions` table.
    """
    try:

        # 2. If the user didn't provide one, generate a fresh one automatically
        if not batch_id:
            batch_id = str(uuid.uuid4())
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
                batch_id=batch_id,
            )

            # If the deal_id already exists, UPDATE the ML scores instead of crashing
            upsert_stmt = stmt.on_conflict_do_update(
                index_elements=["deal_id"],
                set_={
                    "predicted_stage_encoded": stmt.excluded.predicted_stage_encoded,
                    "base_probability": stmt.excluded.base_probability,
                    "confidence_all_classes": stmt.excluded.confidence_all_classes,
                    "batch_id": stmt.excluded.batch_id,
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
