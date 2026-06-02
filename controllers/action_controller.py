from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from models.database import SessionLocal
from models.schema import LLMRecommendation, ZohoDeal
# For the orchestrator:
from controllers.ingestion_controller import ingest_zoho_deals
from controllers.ml_controller import run_batch_predictions
from controllers.recommendation_controller import generate_batch_recommendations

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.patch("/recommendations/{deal_id}/action")
def mark_actioned(deal_id: str, db: Session = Depends(get_db)):
    """
    Marks the latest recommendation for a deal as actioned by the sales rep.
    """
    rec = db.query(LLMRecommendation)\
        .filter(LLMRecommendation.deal_id == deal_id)\
        .order_by(LLMRecommendation.created_at.desc())\
        .first()
        
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
        
    rec.rep_action_taken = True
    rec.rep_feedback_at = datetime.utcnow()
    
    db.commit()
    
    return {"status": "success", "message": f"Deal {deal_id} marked as actioned."}

@router.post("/recommendations/{deal_id}/escalate")
def escalate_deal(deal_id: str, db: Session = Depends(get_db)):
    """
    Marks a deal as escalated.
    """
    deal = db.query(ZohoDeal).filter(ZohoDeal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
        
    deal.is_escalated = True
    db.commit()
    
    return {"status": "success", "message": f"Deal {deal.deal_name} escalated successfully."}


@router.post("/batch/trigger")
async def trigger_full_sync(db: Session = Depends(get_db)):
    """
    Orchestrates the full pipeline:
    1. Ingest Deals
    2. ML Batch Prediction
    3. LLM Batch Recommendation
    """
    try:
        # 1. Ingest
        ingest_res = ingest_zoho_deals()
        
        # 2. Predict
        # We need to pass the db session to the ml controller, but it uses Depends. 
        # So we pass the session we already have.
        ml_res = run_batch_predictions(batch_id=None, db=db)
        batch_id = ml_res.get("batch_id") if isinstance(ml_res, dict) else None
        
        # 3. Recommend
        rec_res = await generate_batch_recommendations(batch_id=batch_id, db=db)
        
        return {
            "status": "success",
            "message": "Full sync complete",
            "details": {
                "ingestion": ingest_res,
                "ml": ml_res,
                "llm": rec_res
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")
