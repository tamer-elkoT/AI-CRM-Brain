from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional

from models.database import SessionLocal
from models.schema import ZohoDeal, MLPrediction, LLMRecommendation
from models.api_schemas import (
    DashboardResponse,
    DashboardKPIs,
    RankedDeal,
    ScatterPoint,
    DealDetailResponse,
    AccountRankingResponse,
    AccountRanking,
)

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/deals/ranked", response_model=DashboardResponse)
def get_dashboard_summary(sort_by: str = "ai_score", limit: Optional[int] = None, db: Session = Depends(get_db)):
    """
    Returns KPIs, ranked deals table, and scatter plot points.
    Joins ZohoDeal -> MLPrediction -> LLMRecommendation to get the latest state.
    """
    
    # 1. Fetch all deals that have recommendations (for MVP, we assume recommendations are the source of truth for the dashboard)
    # To get the latest, we might just query LLMRecommendation and join ZohoDeal and MLPrediction
    
    recs = db.query(ZohoDeal, MLPrediction, LLMRecommendation)\
        .outerjoin(MLPrediction, ZohoDeal.id == MLPrediction.deal_id)\
        .outerjoin(LLMRecommendation, ZohoDeal.id == LLMRecommendation.deal_id)\
        .all()
        
    if not recs:
        # Return empty state if no data yet
        return DashboardResponse(
            kpis=DashboardKPIs(total_active=0, high_priority_count=0, avg_ai_score=0.0),
            scatter_points=[],
            ranked_deals=[]
        )

    # 2. Calculate KPIs
    total_active = len(recs)
    high_priority_count = sum(1 for deal, pred, rec in recs if rec and rec.priority_tier == "HIGH")
    
    total_scores = sum(rec.adjusted_score_pct for deal, pred, rec in recs if rec)
    deals_with_scores = sum(1 for deal, pred, rec in recs if rec)
    avg_ai_score = total_scores / deals_with_scores if deals_with_scores > 0 else 0.0

    kpis = DashboardKPIs(
        total_active=total_active,
        high_priority_count=high_priority_count,
        avg_ai_score=round(avg_ai_score, 1)
    )

    # 3. Scatter Points & Ranked Deals
    scatter_points = []
    ranked_deals = []
    
    for deal, pred, rec in recs:
        ai_score = rec.adjusted_score_pct if rec else 0.0
        ml_score = round(pred.base_probability * 100, 1) if pred and pred.base_probability <= 1 else (pred.base_probability if pred else 0.0)
        priority = rec.priority_tier if rec else "LOW"
        
        scatter_points.append(ScatterPoint(
            deal_id=deal.id,
            deal_name=deal.deal_name,
            amount=deal.amount or 0.0,
            ai_score=ai_score,
            priority=priority
        ))
        
        ranked_deals.append(RankedDeal(
            deal_id=deal.id,
            deal_name=deal.deal_name,
            account_name=deal.account_name or "Unknown",
            priority=priority,
            ml_score=ml_score,
            ai_score=ai_score,
            amount=deal.amount or 0.0
        ))

    # Sort ranked deals
    if sort_by == "ai_score":
        ranked_deals.sort(key=lambda x: x.ai_score, reverse=True)
    elif sort_by == "ml_score":
        ranked_deals.sort(key=lambda x: x.ml_score, reverse=True)
    elif sort_by == "amount":
        ranked_deals.sort(key=lambda x: x.amount, reverse=True)

    if limit is not None:
        ranked_deals = ranked_deals[:limit]

    return DashboardResponse(
        kpis=kpis,
        scatter_points=scatter_points,
        ranked_deals=ranked_deals
    )


@router.get("/deals/{deal_id}", response_model=DealDetailResponse)
def get_deal_detail(deal_id: str, db: Session = Depends(get_db)):
    """
    Fetches full detail for the Right Drawer.
    """
    record = db.query(ZohoDeal, MLPrediction, LLMRecommendation)\
        .outerjoin(MLPrediction, ZohoDeal.id == MLPrediction.deal_id)\
        .outerjoin(LLMRecommendation, ZohoDeal.id == LLMRecommendation.deal_id)\
        .filter(ZohoDeal.id == deal_id)\
        .order_by(LLMRecommendation.created_at.desc())\
        .first()
        
    if not record:
        raise HTTPException(status_code=404, detail="Deal details not found")
        
    deal, pred, rec = record
    
    return DealDetailResponse(
        deal_id=deal.id,
        deal_name=deal.deal_name,
        account_name=deal.account_name or "Unknown",
        stage=deal.stage,
        amount=deal.amount or 0.0,
        closing_date=str(deal.closing_date)[:10] if deal.closing_date else "N/A",
        base_probability=round(pred.base_probability * 100, 1) if pred and pred.base_probability <= 1 else (pred.base_probability if pred else 0.0),
        adjusted_probability=rec.adjusted_score_pct if rec else 0.0,
        recommendation_ar=rec.recommendation_ar if rec else "جاري التحليل...",
        recommendation_en=rec.recommendation_en if rec else "Analysis pending...",
        feature_vector=pred.feature_vector if pred else {},
        risk_flag=rec.risk_flag if rec else "PENDING",
        priority_tier=rec.priority_tier if rec else "LOW"
    )

@router.get("/analytics/accounts/ranked", response_model=AccountRankingResponse)
def get_account_ranking(db: Session = Depends(get_db)):
    """
    Returns accounts ranked by highest average AI win probability.
    """
    results = db.query(
        ZohoDeal.account_name,
        func.avg(LLMRecommendation.adjusted_probability).label('avg_score'),
        func.count(ZohoDeal.id).label('deal_count')
    ).join(
        LLMRecommendation, LLMRecommendation.deal_id == ZohoDeal.id
    ).filter(
        ZohoDeal.account_name != None,
        ZohoDeal.account_name != "Unknown"
    ).group_by(
        ZohoDeal.account_name
    ).order_by(
        func.avg(LLMRecommendation.adjusted_probability).desc()
    ).limit(8).all()

    accounts = []
    for row in results:
        accounts.append(AccountRanking(
            account_name=row.account_name,
            avg_score=round(row.avg_score * 100, 1) if row.avg_score else 0.0,
            deal_count=row.deal_count
        ))

    return AccountRankingResponse(accounts=accounts)
