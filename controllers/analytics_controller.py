"""
Epic 2: Analytics Controller
GET /api/v1/analytics — returns deal + follow-up KPIs for a date range.
For sales_manager users, also returns a rep performance leaderboard.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from datetime import datetime, date, timezone
from typing import Optional
import logging

from models.database import SessionLocal
from models.schema import ZohoDeal, LLMRecommendation, FollowupLog, User
from models.api_schemas import (
    AnalyticsResponse,
    AnalyticsPeriod,
    LeaderboardEntry,
)
from controllers.auth_controller import get_current_user_dep, get_db
from controllers.dashboard_controller import apply_rls

router = APIRouter()
logger = logging.getLogger(__name__)

CLOSED_STAGES = ["Closed Won", "Closed Lost"]


@router.get("/analytics", response_model=AnalyticsResponse)
def get_analytics(
    start_date: Optional[str] = Query(
        None,
        description="Start of the date range (YYYY-MM-DD). Defaults to the 1st of the current month.",
        example="2026-06-01",
    ),
    end_date: Optional[str] = Query(
        None,
        description="End of the date range (YYYY-MM-DD). Defaults to today.",
        example="2026-06-30",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """
    Returns KPIs for a given date range:
    - active_deals: deals NOT in a closed stage, created within the range
    - closed_deals: deals in Closed Won/Lost, created within the range
    - total_followups: follow-up log entries recorded within the range

    If the requesting user has role 'sales_manager', also returns a
    leaderboard of sales rep performance for the same period.
    """
    # ── Parse & validate date range ──────────────────────────────────────────
    today = date.today()
    try:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d") if start_date else datetime(today.year, today.month, 1)
        end_dt = datetime.strptime(end_date, "%Y-%m-%d") if end_date else datetime(today.year, today.month, today.day, 23, 59, 59)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail="Invalid date format. Use YYYY-MM-DD (e.g., 2026-06-01).",
        )

    # Make end_dt inclusive of the whole day
    end_dt = end_dt.replace(hour=23, minute=59, second=59)

    logger.info(
        f"Analytics request by {current_user.email} "
        f"(role={current_user.role}) for {start_dt.date()} → {end_dt.date()}"
    )

    # ── Active deals KPI ─────────────────────────────────────────────────────
    # Deals created in the range that are NOT closed
    # Deals created in the range that are NOT closed
    query = db.query(func.count(ZohoDeal.id))
    query = apply_rls(query, current_user)
    
    active_deals_count = (
        query.filter(
            ZohoDeal.stage.notin_(CLOSED_STAGES),
            # created_at may be null for pre-Epic-1 rows — treat them as in range
            (ZohoDeal.created_at >= start_dt) | (ZohoDeal.created_at.is_(None)),
            (ZohoDeal.created_at <= end_dt) | (ZohoDeal.created_at.is_(None)),
        )
        .scalar() or 0
    )

    # ── Closed deals KPI ─────────────────────────────────────────────────────
    # ZohoDeal has no updated_at column — filter by created_at with null fallback
    # so pre-Epic-1 rows (null created_at) are always included.
    query = db.query(func.count(ZohoDeal.id))
    query = apply_rls(query, current_user)

    closed_deals_count = (
        query.filter(
            ZohoDeal.stage.in_(CLOSED_STAGES),
            (ZohoDeal.created_at >= start_dt) | (ZohoDeal.created_at.is_(None)),
            (ZohoDeal.created_at <= end_dt) | (ZohoDeal.created_at.is_(None)),
        )
        .scalar() or 0
    )

    # ── Follow-up count KPI ───────────────────────────────────────────────────
    query = db.query(func.count(FollowupLog.id)).join(ZohoDeal, FollowupLog.deal_id == ZohoDeal.id)
    query = apply_rls(query, current_user)
    
    followup_count = (
        query.filter(
            FollowupLog.followed_up_at >= start_dt,
            FollowupLog.followed_up_at <= end_dt,
        )
        .scalar() or 0
    )

    # ── Manager leaderboard (role-gated) ─────────────────────────────────────
    leaderboard = None
    if current_user.role in ("sales_manager", "admin"):
        try:
            leaderboard = _build_leaderboard(db, start_dt, end_dt, current_user)
        except Exception as lb_err:
            logger.warning(f"Leaderboard build failed (non-fatal): {lb_err}", exc_info=True)
            leaderboard = []

    return AnalyticsResponse(
        period=AnalyticsPeriod(
            start=start_dt.strftime("%Y-%m-%d"),
            end=end_dt.strftime("%Y-%m-%d"),
        ),
        active_deals=active_deals_count,
        closed_deals=closed_deals_count,
        total_followups=followup_count,
        leaderboard=leaderboard,
    )


def _build_leaderboard(
    db: Session, start_dt: datetime, end_dt: datetime, current_user: User
) -> list[LeaderboardEntry]:
    """
    Build a ranked leaderboard of sales reps for the given period.
    Metrics per rep:
      - closed_deals:   count of deals in Closed Won/Lost
      - followup_count: count of FollowupLog records attributed to them
      - avg_ai_score:   mean adjusted_score_pct from their latest LLM recommendations
    """
    # ── Closed deals per owner ────────────────────────────────────────────────
    query = db.query(
        ZohoDeal.owner_name.label("rep_name"),
        func.count(ZohoDeal.id).label("closed_deals"),
    )
    query = apply_rls(query, current_user)
    
    closed_subq = (
        query.filter(
            ZohoDeal.stage.in_(CLOSED_STAGES),
            # ZohoDeal has no updated_at — use created_at with null fallback
            (ZohoDeal.created_at >= start_dt) | (ZohoDeal.created_at.is_(None)),
            (ZohoDeal.created_at <= end_dt) | (ZohoDeal.created_at.is_(None)),
        )
        .group_by(ZohoDeal.owner_name)
        .subquery()
    )

    # ── Follow-up count per user (via FK to users table) ─────────────────────
    followup_subq = (
        db.query(
            User.name.label("rep_name"),
            func.count(FollowupLog.id).label("followup_count"),
        )
        .join(FollowupLog, FollowupLog.sales_rep_id == User.id)
        .filter(
            User.company_id == current_user.company_id,
            FollowupLog.followed_up_at >= start_dt,
            FollowupLog.followed_up_at <= end_dt,
        )
        .group_by(User.name)
        .subquery()
    )

    # ── Latest rec per deal — for avg_ai_score per owner ─────────────────────
    latest_rec_subq = (
        db.query(
            LLMRecommendation.deal_id,
            func.max(LLMRecommendation.created_at).label("max_created"),
        )
        .group_by(LLMRecommendation.deal_id)
        .subquery()
    )

    from sqlalchemy import Numeric as _Numeric
    query = db.query(
        ZohoDeal.owner_name.label("rep_name"),
        func.round(
            func.avg(LLMRecommendation.adjusted_score_pct).cast(_Numeric),
            1,
        ).label("avg_ai_score"),
    )
    query = apply_rls(query, current_user)
    
    score_subq = (
        query.join(
            latest_rec_subq,
            ZohoDeal.id == latest_rec_subq.c.deal_id,
        )
        .join(
            LLMRecommendation,
            (LLMRecommendation.deal_id == latest_rec_subq.c.deal_id)
            & (LLMRecommendation.created_at == latest_rec_subq.c.max_created),
        )
        .group_by(ZohoDeal.owner_name)
        .subquery()
    )

    # ── Collect all rep names seen in either subquery ─────────────────────────
    rep_names_from_closed = {
        row[0] for row in db.query(closed_subq.c.rep_name).all() if row[0]
    }
    rep_names_from_followups = {
        row[0] for row in db.query(followup_subq.c.rep_name).all() if row[0]
    }
    all_rep_names = rep_names_from_closed | rep_names_from_followups

    if not all_rep_names:
        return []

    # ── Build dict maps for fast lookup ──────────────────────────────────────
    closed_map = {
        row.rep_name: row.closed_deals
        for row in db.query(closed_subq).all()
        if row.rep_name
    }
    followup_map = {
        row.rep_name: row.followup_count
        for row in db.query(followup_subq).all()
        if row.rep_name
    }
    score_map = {
        row.rep_name: round(float(row.avg_ai_score), 1) if row.avg_ai_score else 0.0
        for row in db.query(score_subq).all()
        if row.rep_name
    }

    # ── Assemble leaderboard, sort by closed_deals desc ──────────────────────
    entries: list[LeaderboardEntry] = []
    for rep_name in all_rep_names:
        entries.append(
            LeaderboardEntry(
                rep_name=rep_name,
                closed_deals=closed_map.get(rep_name, 0),
                followup_count=followup_map.get(rep_name, 0),
                avg_ai_score=score_map.get(rep_name, 0.0),
            )
        )

    # Primary sort: most closed deals; secondary: most follow-ups
    entries.sort(key=lambda e: (-e.closed_deals, -e.followup_count))
    return entries
