"""
FastAPI endpoints for LLM recommendation generation.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid
import asyncio
import logging

from models.database import SessionLocal
from models.schema import MLPrediction, LLMRecommendation
from models.ml_engine.data_fusion import fuse_deal_payload
from models.ai_agents.recommender import create_recommender_service
from models.api_schemas import RecommendationResponse
from sqlalchemy.dialects.postgresql import insert

router = APIRouter()
logger = logging.getLogger(__name__)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Initialize LLM service (singleton)
llm_service = create_recommender_service()


@router.post("/recommendations/generate/{deal_id}")
async def generate_single_recommendation(
    deal_id: str, db: Session = Depends(get_db)
) -> RecommendationResponse:
    """
    Generate LLM recommendation for a single deal.
    """
    try:
        # 1. Fetch latest ML prediction for this deal
        prediction = (
            db.query(MLPrediction)
            .filter(MLPrediction.deal_id == deal_id)
            .order_by(MLPrediction.prediction_date.desc())
            .first()
        )

        if not prediction:
            raise HTTPException(
                status_code=404, detail=f"No ML prediction found for deal {deal_id}"
            )

        # 2. Fuse data
        fused_payload = fuse_deal_payload(db, prediction)

        # 1. Normalize the probability inside the dictionary
        raw_prob = float(fused_payload.get("base_probability", 0))
        # Only divide by 100 if it's currently a percentage (e.g., 92.79)
        fused_payload["base_probability"] = raw_prob / 100 if raw_prob > 1 else raw_prob

        # 3. Call LLM (Pass the FULL fused_payload, not just the probability)
        recommendation_data = llm_service.generate_recommendation(fused_payload)

        # 4. Save to database
        # Ensure you save the normalized version to the DB
        rec_record = LLMRecommendation(
            id=str(uuid.uuid4()),
            deal_id=deal_id,
            prediction_id=str(prediction.id),
            **recommendation_data,
        )

        db.add(rec_record)
        db.commit()
        db.refresh(rec_record)

        return RecommendationResponse(
            status="success",
            message="Recommendation generated successfully",
            recommendations_generated=1,
            predictions_processed=1,
            # Unpack the recommendation details into the response
            **recommendation_data,
        )

    except Exception as e:
        logger.error(f"Recommendation generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/recommendations/batch")
async def generate_batch_recommendations(
    batch_id: str = None, db: Session = Depends(get_db)
):
    """
    Generate recommendations for all deals with recent ML predictions.
    """
    try:
        if not batch_id:
            batch_id = str(uuid.uuid4())

        # 1. Fetch all recent predictions (last batch)
        predictions = (
            db.query(MLPrediction).filter(MLPrediction.batch_id == batch_id).all()
        )

        if not predictions:
            return {
                "status": "success",
                "message": "No predictions found for batch",
                "batch_id": batch_id,
                "recommendations_generated": 0,
            }

        # 2. Process in parallel (async)
        async def process_single(pred):
            fused = fuse_deal_payload(db, pred)
            return llm_service.generate_recommendation(fused)

        # Use asyncio.gather for parallel LLM calls
        recommendations = await asyncio.gather(
            *[process_single(p) for p in predictions], return_exceptions=True
        )

        # 3. Upsert to database
        success_count = 0
        for pred, rec_data in zip(predictions, recommendations):
            if isinstance(rec_data, Exception):
                logger.error(f"LLM failed for deal {pred.deal_id}: {rec_data}")
                continue

            try:
                stmt = insert(LLMRecommendation).values(
                    id=str(uuid.uuid4()),
                    deal_id=pred.deal_id,
                    prediction_id=str(pred.id),
                    batch_id=batch_id,
                    **rec_data,
                )

                # Upsert: update if deal_id + batch_id already exists
                upsert_stmt = stmt.on_conflict_do_update(
                    index_elements=["deal_id", "batch_id"],
                    set_={
                        "adjusted_probability": stmt.excluded.adjusted_probability,
                        "recommendation_ar": stmt.excluded.recommendation_ar,
                        "recommendation_en": stmt.excluded.recommendation_en,
                        "risk_flag": stmt.excluded.risk_flag,
                        "llm_latency_ms": stmt.excluded.llm_latency_ms,
                        "updated_at": stmt.excluded.updated_at,
                    },
                )

                db.execute(upsert_stmt)
                success_count += 1

            except Exception as e:
                logger.error(f"DB upsert failed for deal {pred.deal_id}: {e}")

        db.commit()

        return {
            "status": "success",
            "message": f"Generated {success_count} recommendations",
            "batch_id": batch_id,
            "recommendations_generated": success_count,
            "predictions_processed": len(predictions),
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Batch recommendation failed: {str(e)}"
        )
