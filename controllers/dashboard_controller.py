from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional

from models.database import SessionLocal
from models.schema import ZohoDeal, MLPrediction, LLMRecommendation, FollowupLog, Notification, User
from controllers.auth_controller import get_current_user_dep
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
    DealCreate,
    StageUpdateRequest,
)

CLOSED_STAGES = ['Closed Won', 'Closed Lost']

ALLOWED_STAGES = [
    'Qualification', 'Needs Analysis', 'Value Proposition',
    'Identify Decision Makers', 'Proposal/Price Quote',
    'Negotiation/Review', 'Closed Won', 'Closed Lost',
]

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_followup_stats(db: Session, deal_id: str):
    """Helper: get followup count and last date for a deal."""
    count = db.query(func.count(FollowupLog.id)).filter(FollowupLog.deal_id == deal_id).scalar() or 0
    last = db.query(func.max(FollowupLog.followed_up_at)).filter(FollowupLog.deal_id == deal_id).scalar()
    last_str = str(last)[:10] if last else None
    return count, last_str


def apply_rls(query, current_user: User):
    """Applies Epic 2 multi-tenant and role-based filters to a ZohoDeal query."""
    if current_user.company_id:
        query = query.filter(ZohoDeal.company_id == current_user.company_id)
    if current_user.role == "rep":
        query = query.filter(ZohoDeal.owner_name == current_user.name)
    return query


@router.get("/deals", response_model=PaginatedDealsResponse)
def get_all_deals(
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
    sort_by: str = "ai_score",
    include_closed: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """
    Returns deals with pagination, search, and sorting.
    By default, filters out 'Closed Won' and 'Closed Lost' deals (Feature 1).
    Set include_closed=true to show only closed deals.
    """
    query = db.query(ZohoDeal, MLPrediction, LLMRecommendation)\
        .outerjoin(MLPrediction, ZohoDeal.id == MLPrediction.deal_id)\
        .outerjoin(LLMRecommendation, ZohoDeal.id == LLMRecommendation.deal_id)

    # Epic 2: Row-Level Security
    query = apply_rls(query, current_user)

    # Feature 1: Filter closed deals from active pipeline
    if include_closed:
        query = query.filter(ZohoDeal.stage.in_(CLOSED_STAGES))
    else:
        query = query.filter(ZohoDeal.stage.notin_(CLOSED_STAGES))

    # Search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (ZohoDeal.deal_name.ilike(search_term)) |
            (ZohoDeal.account_name.ilike(search_term))
        )

    all_results = query.all()
    total = len(all_results)

    # Build ranked deals with Sprint 5 enrichment
    deals = []
    for deal, pred, rec in all_results:
        ai_score = rec.adjusted_score_pct if rec else 0.0
        ml_score = round(pred.base_probability * 100, 1) if pred and pred.base_probability <= 1 else (pred.base_probability if pred else 0.0)
        priority = rec.priority_tier if rec else "LOW"
        followup_count, last_followup_date = _get_followup_stats(db, deal.id)

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
            action_status=deal.action_status or "no_action",
            followup_count=followup_count,
            last_followup_date=last_followup_date,
            owner_name=deal.owner_name,
            followup_days_override=deal.followup_days_override or 3,
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
    elif sort_by == "risk":
        # Risk = lowest AI score with highest amount (most money at stake)
        deals.sort(key=lambda x: (x.ai_score, -x.amount))

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


@router.post("/deals")
def create_deal(
    deal_data: DealCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep)
):
    """
    Create a new deal manually (not from CRM sync).
    Epic 1: explicitly sets expected_revenue and custom_fields={} to avoid nulls.
    """
    import uuid
    from datetime import datetime

    deal_id = f"MANUAL-{uuid.uuid4().hex[:12].upper()}"

    closing_dt = None
    if deal_data.closing_date:
        try:
            closing_dt = datetime.strptime(deal_data.closing_date, "%Y-%m-%d")
        except ValueError:
            closing_dt = None

    new_deal = ZohoDeal(
        id=deal_id,
        deal_name=deal_data.deal_name,
        account_name=deal_data.account_name,
        contact_name=deal_data.contact_name,
        owner_name=deal_data.owner_name,
        amount=deal_data.amount,
        # Epic 1 fix: now read from schema (default 0.0), never null
        expected_revenue=deal_data.expected_revenue,
        stage=deal_data.stage,
        zoho_probability=deal_data.zoho_probability,
        closing_date=closing_dt,
        client_phone=deal_data.client_phone,
        client_email=deal_data.client_email,
        # Epic 1 fix: always start with empty dict, not null
        custom_fields={},
        company_id=current_user.company_id,
    )

    db.add(new_deal)
    db.commit()
    db.refresh(new_deal)

    return {
        "status": "success",
        "message": f"Deal '{deal_data.deal_name}' created successfully.",
        "deal_id": deal_id,
    }


@router.get("/deals/ranked", response_model=DashboardResponse)
def get_dashboard_summary(
    sort_by: str = "ai_score", 
    limit: Optional[int] = None, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep)
):
    """
    Returns KPIs, ranked deals table, and scatter plot points.
    Uses a subquery to get only the LATEST recommendation per deal,
    preventing duplicate rows when a deal has multiple batch recommendations.
    Feature 1: Excludes closed deals from dashboard.
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
    # Feature 1: Exclude closed deals from dashboard
    # Apply RLS
    query = (
        db.query(ZohoDeal, MLPrediction, LLMRecommendation)
        .filter(ZohoDeal.stage.notin_(CLOSED_STAGES))
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
    )
    query = apply_rls(query, current_user)
    recs = query.all()

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
def get_deal_detail(
    deal_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep)
):
    """
    Fetches full detail for the Right Drawer.
    Gets the LATEST recommendation for this deal to avoid stale data.
    """
    query = db.query(ZohoDeal).filter(ZohoDeal.id == deal_id)
    query = apply_rls(query, current_user)
    deal = query.first()
    
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found or access denied")

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

    followup_count, last_followup_date = _get_followup_stats(db, deal.id)

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
        # Sprint 5: Follow-up & Action fields
        action_status=deal.action_status or "no_action",
        followup_count=followup_count,
        last_followup_date=last_followup_date,
        owner_name=deal.owner_name,
        followup_days_override=deal.followup_days_override or 3,
    )


@router.get("/analytics/accounts/ranked", response_model=AccountRankingResponse)
def get_account_ranking(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep)
):
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

    query = (
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
    )
    query = apply_rls(query, current_user)
    
    results = (
        query
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


@router.get("/accounts/names")
def get_account_names(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep)
):
    """
    Returns a list of distinct account names from all deals.
    Used by the CreateDealModal dropdown.
    """
    query = db.query(ZohoDeal.account_name)\
        .filter(ZohoDeal.account_name.isnot(None))
    query = apply_rls(query, current_user)
    
    results = query\
        .distinct()\
        .order_by(ZohoDeal.account_name)\
        .all()

    return [row[0] for row in results if row[0]]


# ============================================================
# Sprint 5: Inline Stage Editing (Feature 9)
# ============================================================
@router.patch("/deals/{deal_id}/stage")
def update_deal_stage(
    deal_id: str,
    request: StageUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """
    Feature 9: Update a deal's stage inline from the pipeline table.
    Creates a notification when the stage changes.
    """
    query = db.query(ZohoDeal).filter(ZohoDeal.id == deal_id)
    query = apply_rls(query, current_user)
    deal = query.first()
    
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found or access denied")

    if request.new_stage not in ALLOWED_STAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid stage. Allowed: {', '.join(ALLOWED_STAGES)}"
        )

    old_stage = deal.stage
    deal.stage = request.new_stage

    # If moved to closed, clear action status
    if request.new_stage in CLOSED_STAGES:
        deal.action_status = "no_action"

    # Create notification for stage change
    # Find the deal owner in the users table
    if deal.owner_name:
        owner = db.query(User).filter(User.name == deal.owner_name).first()
        if owner:
            notification = Notification(
                user_id=owner.id,
                deal_id=deal.id,
                type="deal_updated",
                title=f"Stage Changed: {deal.deal_name}",
                body=f"Deal stage changed from '{old_stage}' to '{request.new_stage}'.",
            )
            db.add(notification)

    db.commit()

    return {
        "status": "success",
        "message": f"Deal stage updated from '{old_stage}' to '{request.new_stage}'.",
        "deal_id": deal_id,
        "old_stage": old_stage,
        "new_stage": request.new_stage,
    }


# ============================================================
# Epic 2: Delete Deal (Feature 1)
# ============================================================
@router.delete("/deals/{deal_id}")
def delete_deal(
    deal_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """
    Deletes a deal and all related records (cascades via FK).
    RLS ensures reps can only delete their own deals; managers/admins can delete
    any deal in their company.
    """
    query = db.query(ZohoDeal).filter(ZohoDeal.id == deal_id)
    query = apply_rls(query, current_user)
    deal = query.first()

    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found or access denied.")

    db.delete(deal)
    db.commit()

    return {"status": "success", "message": f"Deal '{deal.deal_name}' deleted.", "deal_id": deal_id}


# ============================================================
# Epic 2: Inline Contact Info Editing (Feature 2)
# ============================================================
from pydantic import BaseModel as _BM

class ContactUpdateRequest(_BM):
    client_phone: str | None = None
    client_email: str | None = None


@router.patch("/deals/{deal_id}/contact")
def update_deal_contact(
    deal_id: str,
    request: ContactUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """
    Epic 2 Feature 2: Inline-edit a deal's client phone and/or email.
    Respects RLS so reps can only edit their own deals.
    """
    query = db.query(ZohoDeal).filter(ZohoDeal.id == deal_id)
    query = apply_rls(query, current_user)
    deal = query.first()

    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found or access denied.")

    if request.client_phone is not None:
        deal.client_phone = request.client_phone
    if request.client_email is not None:
        deal.client_email = request.client_email

    db.commit()
    db.refresh(deal)

    return {
        "status": "success",
        "message": "Contact info updated.",
        "deal_id": deal_id,
        "client_phone": deal.client_phone,
        "client_email": deal.client_email,
    }


# ============================================================
# Epic 3: Inline Deal Details Editing (Amount, Closing Date)
# ============================================================
class DealDetailsUpdateRequest(_BM):
    amount: float | None = None
    closing_date: str | None = None


@router.patch("/deals/{deal_id}/details")
def update_deal_details(
    deal_id: str,
    request: DealDetailsUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """
    Epic 3: Inline-edit a deal's amount and closing date.
    Respects RLS so reps can only edit their own deals.
    """
    query = db.query(ZohoDeal).filter(ZohoDeal.id == deal_id)
    query = apply_rls(query, current_user)
    deal = query.first()

    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found or access denied.")

    if request.amount is not None:
        deal.amount = request.amount
    if request.closing_date is not None:
        from datetime import datetime
        try:
            deal.closing_date = datetime.strptime(request.closing_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    db.commit()
    db.refresh(deal)

    return {
        "status": "success",
        "message": "Deal details updated.",
        "deal_id": deal_id,
        "amount": deal.amount,
        "closing_date": str(deal.closing_date) if deal.closing_date else None,
    }
