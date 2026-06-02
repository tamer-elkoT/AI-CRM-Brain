from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional

from models.database import SessionLocal
from models.schema import ZohoDeal, MLPrediction, LLMRecommendation
import math

from models.api_schemas import (
    DashboardResponse,
    DashboardKPIs,
    RankedDeal,
    ScatterPoint,
    DealDetailResponse,
    AccountRankingResponse,
    AccountRanking,
    PaginatedDealsResponse,
)

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/deals", response_model=PaginatedDealsResponse)
def get_all_deals(
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
    sort_by: str = "ai_score",
    db: Session = Depends(get_db),
):
    """
    Returns ALL deals with pagination, search, and sorting.
    Used by the Home pipeline table.
    """
    query = db.query(ZohoDeal, MLPrediction, LLMRecommendation)\
        .outerjoin(MLPrediction, ZohoDeal.id == MLPrediction.deal_id)\
        .outerjoin(LLMRecommendation, ZohoDeal.id == LLMRecommendation.deal_id)

    # Search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (ZohoDeal.deal_name.ilike(search_term)) |
            (ZohoDeal.account_name.ilike(search_term))
        )

    all_results = query.all()
    total = len(all_results)

    # Build ranked deals
    deals = []
    for deal, pred, rec in all_results:
        ai_score = rec.adjusted_score_pct if rec else 0.0
        ml_score = round(pred.base_probability * 100, 1) if pred and pred.base_probability <= 1 else (pred.base_probability if pred else 0.0)
        priority = rec.priority_tier if rec else "LOW"

        deals.append(RankedDeal(
            deal_id=deal.id,
            deal_name=deal.deal_name,
            account_name=deal.account_name or "Unknown",
            priority=priority,
            ml_score=ml_score,
            ai_score=ai_score,
            amount=deal.amount or 0.0,
            stage=deal.stage,
            closing_date=str(deal.closing_date)[:10] if deal.closing_date else "N/A",
            client_phone=deal.client_phone,
            client_email=deal.client_email,
        ))

    # Sort
    if sort_by == "ai_score":
        deals.sort(key=lambda x: x.ai_score, reverse=True)
    elif sort_by == "ml_score":
        deals.sort(key=lambda x: x.ml_score, reverse=True)
    elif sort_by == "amount":
        deals.sort(key=lambda x: x.amount, reverse=True)
    elif sort_by == "deal_name":
        deals.sort(key=lambda x: x.deal_name.lower())

    # Paginate
    total_pages = max(1, math.ceil(total / page_size))
    start = (page - 1) * page_size
    end = start + page_size
    paginated = deals[start:end]

    return PaginatedDealsResponse(
        items=paginated,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/deals/ranked", response_model=DashboardResponse)
def get_dashboard_summary(sort_by: str = "ai_score", limit: Optional[int] = None, db: Session = Depends(get_db)):
    """
    Returns KPIs, ranked deals table, and scatter plot points.
    Uses a subquery to get only the LATEST recommendation per deal,
    preventing duplicate rows when a deal has multiple batch recommendations.
    """

    # Subquery: latest recommendation id per deal
    latest_rec_subq = (
        db.query(
            LLMRecommendation.deal_id,
            func.max(LLMRecommendation.created_at).label("max_created_at"),
        )
        .group_by(LLMRecommendation.deal_id)
        .subquery()
    )

    # Main query: all deals, left-joined to their latest recommendation only
    recs = (
        db.query(ZohoDeal, MLPrediction, LLMRecommendation)
        .outerjoin(MLPrediction, ZohoDeal.id == MLPrediction.deal_id)
        .outerjoin(
            latest_rec_subq,
            ZohoDeal.id == latest_rec_subq.c.deal_id,
        )
        .outerjoin(
            LLMRecommendation,
            (LLMRecommendation.deal_id == latest_rec_subq.c.deal_id)
            & (LLMRecommendation.created_at == latest_rec_subq.c.max_created_at),
        )
        .all()
    )

    if not recs:
        return DashboardResponse(
            kpis=DashboardKPIs(total_active=0, high_priority_count=0, avg_ai_score=0.0),
            scatter_points=[],
            ranked_deals=[],
        )

    # KPIs
    total_active = len(recs)
    high_priority_count = sum(1 for _, _, rec in recs if rec and rec.priority_tier == "HIGH")
    scores = [rec.adjusted_score_pct for _, _, rec in recs if rec and rec.adjusted_score_pct is not None]
    avg_ai_score = (sum(scores) / len(scores)) if scores else 0.0

    kpis = DashboardKPIs(
        total_active=total_active,
        high_priority_count=high_priority_count,
        avg_ai_score=round(avg_ai_score, 1),
    )

    # Build scatter + ranked lists
    scatter_points = []
    ranked_deals = []

    for deal, pred, rec in recs:
        ai_score = rec.adjusted_score_pct if rec else 0.0
        ml_prob = pred.base_probability if pred else 0.0
        # base_probability is stored as a percentage (e.g. 92.84) from the ML engine
        ml_score = round(ml_prob, 1) if ml_prob > 1 else round(ml_prob * 100, 1)
        priority = rec.priority_tier if rec else "LOW"

        scatter_points.append(
            ScatterPoint(
                deal_id=deal.id,
                deal_name=deal.deal_name,
                amount=deal.amount or 0.0,
                ai_score=ai_score,
                priority=priority,
            )
        )

        ranked_deals.append(
            RankedDeal(
                deal_id=deal.id,
                deal_name=deal.deal_name,
                account_name=deal.account_name or "Unknown",
                priority=priority,
                ml_score=ml_score,
                ai_score=ai_score,
                amount=deal.amount or 0.0,
            )
        )

    # Sort
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
        ranked_deals=ranked_deals,
    )


@router.get("/deals/{deal_id}", response_model=DealDetailResponse)
def get_deal_detail(deal_id: str, db: Session = Depends(get_db)):
    """
    Fetches full detail for the Right Drawer.
    Gets the LATEST recommendation for this deal to avoid stale data.
    """
    deal = db.query(ZohoDeal).filter(ZohoDeal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    pred = (
        db.query(MLPrediction)
        .filter(MLPrediction.deal_id == deal_id)
        .order_by(MLPrediction.updated_at.desc())
        .first()
    )

    rec = (
        db.query(LLMRecommendation)
        .filter(LLMRecommendation.deal_id == deal_id)
        .order_by(LLMRecommendation.created_at.desc())
        .first()
    )

    ml_prob = pred.base_probability if pred else 0.0
    ml_score = round(ml_prob, 1) if ml_prob > 1 else round(ml_prob * 100, 1)

    return DealDetailResponse(
        deal_id=deal.id,
        deal_name=deal.deal_name,
        account_name=deal.account_name or "Unknown",
        stage=deal.stage,
        amount=deal.amount or 0.0,
        closing_date=str(deal.closing_date)[:10] if deal.closing_date else "N/A",
        base_probability=ml_score,
        adjusted_probability=rec.adjusted_score_pct if rec else 0.0,
        recommendation_ar=rec.recommendation_ar if rec else "جاري التحليل...",
        recommendation_en=rec.recommendation_en if rec else "Analysis pending...",
        feature_vector=pred.feature_vector if pred else {},
        risk_flag=rec.risk_flag if rec else "PENDING",
        priority_tier=rec.priority_tier if rec else "LOW",
        # Dynamic contact fields — populated after re-sync from Zoho
        client_phone=deal.client_phone,
        client_email=deal.client_email,
    )


@router.get("/analytics/accounts/ranked", response_model=AccountRankingResponse)
def get_account_ranking(db: Session = Depends(get_db)):
    """
    Returns accounts ranked by highest average AI win probability.
    Uses outer join so accounts appear even without recommendations.
    Defaults avg_score to 0 when no recommendation exists.
    """
    # Subquery: latest rec per deal (same dedup logic)
    latest_rec_subq = (
        db.query(
            LLMRecommendation.deal_id,
            func.max(LLMRecommendation.created_at).label("max_created_at"),
        )
        .group_by(LLMRecommendation.deal_id)
        .subquery()
    )

    results = (
        db.query(
            ZohoDeal.account_name,
            func.avg(
                func.coalesce(LLMRecommendation.adjusted_score_pct, 0)
            ).label("avg_score"),
            func.count(ZohoDeal.id).label("deal_count"),
        )
        .outerjoin(latest_rec_subq, latest_rec_subq.c.deal_id == ZohoDeal.id)
        .outerjoin(
            LLMRecommendation,
            (LLMRecommendation.deal_id == latest_rec_subq.c.deal_id)
            & (LLMRecommendation.created_at == latest_rec_subq.c.max_created_at),
        )
        .filter(
            ZohoDeal.account_name.isnot(None),
            ZohoDeal.account_name != "Unknown",
        )
        .group_by(ZohoDeal.account_name)
        .order_by(
            func.avg(func.coalesce(LLMRecommendation.adjusted_score_pct, 0)).desc()
        )
        .limit(8)
        .all()
    )

    accounts = []
    for row in results:
        avg = row.avg_score if row.avg_score is not None else 0.0
        # adjusted_score_pct is already stored as a percentage (0–100) via the computed column
        accounts.append(
            AccountRanking(
                account_name=row.account_name,
                avg_score=round(float(avg), 1),
                deal_count=row.deal_count,
            )
        )

    return AccountRankingResponse(accounts=accounts)
