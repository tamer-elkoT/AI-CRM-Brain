"""
FastAPI endpoints for LLM recommendation generation.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
import uuid
import asyncio
import logging

from models.database import SessionLocal
from models.schema import ZohoDeal, MLPrediction, LLMRecommendation, User
from models.ml_engine.data_fusion import fuse_deal_payload
from models.ml_engine.inference import preprocess_new_deal, predict_batch
from models.ai_agents.recommender import create_recommender_service
from models.api_schemas import RecommendationResponse
from services.notification_service import evaluate_and_notify
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.sql import func

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


# --- Urgent Deal Notification (BackgroundTask) ---
def notify_sales_manager(deal_name: str, account_name: str, amount: float, recommendation_ar: str, risk_flag: str):
    """
    Log an urgent deal alert to the server console (legacy compatibility).
    """
    try:
        border  = "=" * 62
        divider = "-" * 62
        logger.warning(
            "\n"
            + f"\u2554{border}\u2557\n"
            + f"\u2551  \U0001f6a8 URGENT DEAL ALERT: {deal_name[:40]:<42}\u2551\n"
            + f"\u255f{divider}\u2562\n"
            + f"\u2551  Account:  {account_name[:50]:<52}\u2551\n"
            + f"\u2551  Amount:   ${amount:>12,.0f}{'':38}\u2551\n"
            + f"\u2551  Risk:     {str(risk_flag):<52}\u2551\n"
            + f"\u255f{divider}\u2562\n"
            + f"\u2551  AI: {str(recommendation_ar[:55]):<58}\u2551\n"
            + f"\u255a{border}\u255d"
        )
    except Exception as e:
        logger.warning(f"URGENT DEAL: {deal_name} | Amount: {amount} | Risk: {risk_flag}")


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

        # Pop fallback keys to avoid DB schema mismatch if LLM failed
        recommendation_data.pop("error", None)
        recommendation_data.pop("is_fallback", None)

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


@router.post("/recommendations/generate")
async def generate_all_recommendations(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Full AI pipeline: For all deals that lack ML predictions or LLM recommendations,
    run the ML model and LLM agent to generate scores and recommendations.
    """
    try:
        batch_id = str(uuid.uuid4())
        
        # ─── Phase 1: Find deals missing ML predictions ───
        deals_needing_predictions = db.query(ZohoDeal).outerjoin(
            MLPrediction, ZohoDeal.id == MLPrediction.deal_id
        ).filter(MLPrediction.id == None).all()
        
        ml_processed = 0
        if deals_needing_predictions:
            raw_deals = []
            for d in deals_needing_predictions:
                raw_deals.append({
                    "Deal_ID": d.id,
                    "Amount": d.amount,
                    "Closing_Date": str(d.closing_date) if d.closing_date else "2026-12-31",
                    "Owner_Name": d.owner_name or "Unknown",
                    "Account_Name": d.account_name or "Unknown",
                    "Stage": d.stage,
                })
            
            X_processed = preprocess_new_deal(raw_deals)
            ml_results = predict_batch(X_processed)
            
            for raw, res in zip(raw_deals, ml_results):
                stmt = insert(MLPrediction).values(
                    deal_id=raw["Deal_ID"],
                    predicted_stage_encoded=res["predicted_stage_encoded"],
                    base_probability=res["base_probability"],
                    confidence_all_classes=res["confidence_all_classes"],
                    batch_id=batch_id,
                )
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
                ml_processed += 1
            
            db.commit()
            logger.info(f"Phase 1: Generated ML predictions for {ml_processed} deals.")
        
        # ─── Phase 2: Find deals missing LLM recommendations ───
        deals_needing_recs = db.query(MLPrediction).outerjoin(
            LLMRecommendation, MLPrediction.deal_id == LLMRecommendation.deal_id
        ).filter(LLMRecommendation.id == None).all()
        
        rec_generated = 0
        urgent_count = 0
        
        for prediction in deals_needing_recs:
            try:
                # Fuse data
                fused_payload = fuse_deal_payload(db, prediction)
                
                # Normalize probability
                raw_prob = float(fused_payload.get("base_probability", 0))
                fused_payload["base_probability"] = raw_prob / 100 if raw_prob > 1 else raw_prob
                
                # Call LLM
                recommendation_data = llm_service.generate_recommendation(fused_payload)
                
                # Pop fallback keys to avoid DB schema mismatch
                recommendation_data.pop("error", None)
                recommendation_data.pop("is_fallback", None)

                # Upsert to DB
                stmt = insert(LLMRecommendation).values(
                    id=str(uuid.uuid4()),
                    deal_id=prediction.deal_id,
                    prediction_id=str(prediction.id),
                    batch_id=batch_id,
                    **recommendation_data,
                )
                upsert_stmt = stmt.on_conflict_do_update(
                    index_elements=["deal_id", "batch_id"],
                    set_={
                        "adjusted_probability": stmt.excluded.adjusted_probability,
                        "recommendation_ar": stmt.excluded.recommendation_ar,
                        "recommendation_en": stmt.excluded.recommendation_en,
                        "risk_flag": stmt.excluded.risk_flag,
                        "llm_latency_ms": stmt.excluded.llm_latency_ms,
                        "updated_at": func.now(),
                    },
                )
                db.execute(upsert_stmt)
                rec_generated += 1
                
                # ─── WhatsApp Alert Evaluation (BackgroundTask) ───
                adj_prob = recommendation_data.get("adjusted_probability", 1.0)
                deal_amount = fused_payload.get("amount", 0)
                risk_flag = recommendation_data.get("risk_flag", "NONE")
                
                is_urgent = (
                    (deal_amount >= 50000 and adj_prob < 0.45) or
                    risk_flag in ("HIGH_RISK", "STALLED", "COMPETITOR_PRESENT") or
                    adj_prob > 0.85
                )
                
                if is_urgent:
                    urgent_count += 1
                    # Look up the deal owner's verified phone from the User table
                    owner_name = fused_payload.get("owner_name", "Unknown")
                    owner_user = db.query(User).filter(
                        User.name.ilike(owner_name),
                        User.is_whatsapp_verified == True,
                    ).first()
                    owner_phone = owner_user.phone_number if owner_user else fused_payload.get("client_phone")

                    background_tasks.add_task(
                        evaluate_and_notify,
                        deal_name=fused_payload.get("deal_name", "Unknown"),
                        account_name=fused_payload.get("account_name", "Unknown"),
                        amount=deal_amount,
                        adjusted_probability=adj_prob,
                        risk_flag=risk_flag,
                        owner_name=owner_name,
                        owner_phone=owner_phone,
                        recommendation_ar=recommendation_data.get("recommendation_ar", ""),
                        user_id=str(owner_user.id) if owner_user else None,
                    )
                    # Keep legacy manager notification for backwards compatibility
                    background_tasks.add_task(
                        notify_sales_manager,
                        deal_name=fused_payload.get("deal_name", "Unknown"),
                        account_name=fused_payload.get("account_name", "Unknown"),
                        amount=deal_amount,
                        recommendation_ar=recommendation_data.get("recommendation_ar", ""),
                        risk_flag=risk_flag,
                    )
                
            except Exception as e:
                logger.error(f"LLM failed for deal {prediction.deal_id}: {e}")
                continue
        
        db.commit()

        # ─── Sprint 5: Auto-classify and schedule follow-ups ───────────────────
        try:
            from services.deal_classifier import classify_all_deals
            classify_db = SessionLocal()
            try:
                result = classify_all_deals(classify_db)
                logger.info(f"Auto-classify result: {result}")
            finally:
                classify_db.close()
        except Exception as fu_err:
            logger.warning(f"Deal classification failed (non-fatal): {fu_err}")

        # ─── Auto-schedule follow-ups for ALL deals ────────────────────────────
        try:
            from controllers.followup_controller import _schedule_all_followups
            sched_db = SessionLocal()
            try:
                scheduled = _schedule_all_followups(sched_db)
                logger.info(f"Auto-scheduled {scheduled} follow-up records.")
            finally:
                sched_db.close()
        except Exception as sched_err:
            logger.warning(f"Follow-up scheduling failed (non-fatal): {sched_err}")

        # ─── Immediately fire WhatsApp notifications in background ─────────────
        import threading
        def _fire_whatsapp():
            try:
                from services.followup_scheduler import check_deferred_followups
                check_deferred_followups()
            except Exception as e:
                logger.error(f"WhatsApp notification error: {e}")
        threading.Thread(target=_fire_whatsapp, daemon=True).start()
        logger.info("🔔 WhatsApp follow-up notifications queued in background.")

        return {
            "status": "success",
            "message": f"AI pipeline complete. {ml_processed} ML predictions + {rec_generated} LLM recommendations generated. WhatsApp alerts queued.",
            "batch_id": batch_id,
            "ml_predictions_generated": ml_processed,
            "recommendations_generated": rec_generated,
            "urgent_deals_flagged": urgent_count,
        }
    
    except Exception as e:
        db.rollback()
        logger.error(f"AI recommendation pipeline failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI pipeline failed: {str(e)}")


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
                # Pop fallback keys to avoid DB schema mismatch
                rec_data.pop("error", None)
                rec_data.pop("is_fallback", None)

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
