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
    PipelineAnalyticsResponse,
    StageBreakdown,
    TopDealEntry,
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


# ============================================================
# Analytics Pipeline Endpoint
# ============================================================

@router.get("/analytics/pipeline", response_model=PipelineAnalyticsResponse)
def get_pipeline_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """
    Returns all KPIs and stage breakdown data needed for the Analytics Dashboard:
    - active_pipeline_value: SUM amount for all non-closed deals
    - total_won_amount: SUM amount for Closed Won deals
    - win_rate_pct: closed_won / (closed_won + closed_lost) * 100
    - at_risk_value: SUM amount for deals where action_status = need_action_now
    - stage_breakdown: list of (stage, count, total_amount, pct)
    - top_deals: top 5 deals by amount (any non-closed stage)
    """

    # ── Base query with RLS ───────────────────────────────────────────────────
    def base_q():
        q = db.query(ZohoDeal)
        return apply_rls(q, current_user)

    # ── Active pipeline value (non-closed) ───────────────────────────────────
    active_q = db.query(func.coalesce(func.sum(ZohoDeal.amount), 0.0))
    active_q = apply_rls(active_q, current_user)
    active_pipeline_value = float(
        active_q.filter(ZohoDeal.stage.notin_(CLOSED_STAGES)).scalar() or 0.0
    )

    # ── Total won amount ──────────────────────────────────────────────────────
    won_q = db.query(func.coalesce(func.sum(ZohoDeal.amount), 0.0))
    won_q = apply_rls(won_q, current_user)
    total_won_amount = float(
        won_q.filter(ZohoDeal.stage == "Closed Won").scalar() or 0.0
    )

    # ── Closed Won / Lost counts for win rate ────────────────────────────────
    won_count_q = db.query(func.count(ZohoDeal.id))
    won_count_q = apply_rls(won_count_q, current_user)
    closed_won_count = int(won_count_q.filter(ZohoDeal.stage == "Closed Won").scalar() or 0)

    lost_count_q = db.query(func.count(ZohoDeal.id))
    lost_count_q = apply_rls(lost_count_q, current_user)
    closed_lost_count = int(lost_count_q.filter(ZohoDeal.stage == "Closed Lost").scalar() or 0)

    total_closed = closed_won_count + closed_lost_count
    win_rate_pct = round((closed_won_count / total_closed) * 100, 1) if total_closed > 0 else 0.0

    # ── At-risk deals (need_action_now) ──────────────────────────────────────
    risk_q = db.query(
        func.count(ZohoDeal.id),
        func.coalesce(func.sum(ZohoDeal.amount), 0.0),
    )
    risk_q = apply_rls(risk_q, current_user)
    risk_row = risk_q.filter(
        ZohoDeal.action_status == "need_action_now",
        ZohoDeal.stage.notin_(CLOSED_STAGES),
    ).first()
    at_risk_deal_count = int(risk_row[0]) if risk_row else 0
    at_risk_value = float(risk_row[1]) if risk_row else 0.0

    # ── Other stalled count (active but not in won/lost) ─────────────────────
    stalled_q = db.query(func.count(ZohoDeal.id))
    stalled_q = apply_rls(stalled_q, current_user)
    other_stalled_count = int(
        stalled_q.filter(
            ZohoDeal.stage.notin_(CLOSED_STAGES + ["Closed Won", "Closed Lost"]),
            ZohoDeal.action_status != "need_action_now",
        ).scalar() or 0
    )

    # ── Stage breakdown ───────────────────────────────────────────────────────
    stage_q = db.query(
        ZohoDeal.stage,
        func.count(ZohoDeal.id).label("deal_count"),
        func.coalesce(func.sum(ZohoDeal.amount), 0.0).label("total_amount"),
    )
    stage_q = apply_rls(stage_q, current_user)
    stage_rows = (
        stage_q
        .filter(ZohoDeal.stage.notin_(CLOSED_STAGES))
        .group_by(ZohoDeal.stage)
        .order_by(func.sum(ZohoDeal.amount).desc())
        .all()
    )

    # Stage ordering priority (pipeline funnel order)
    STAGE_ORDER = [
        "Value Proposition", "Qualification", "Needs Analysis",
        "Id. Decision Makers", "Perception Analysis",
        "Proposal/Price Quote", "Negotiation/Review",
        "Discovery", "Proposal", "Negotiation", "Closing",
    ]

    def stage_sort_key(row):
        try:
            return STAGE_ORDER.index(row.stage)
        except ValueError:
            return 999

    stage_rows_sorted = sorted(stage_rows, key=stage_sort_key)

    stage_breakdown = []
    for row in stage_rows_sorted:
        pct = round((float(row.total_amount) / active_pipeline_value) * 100, 1) if active_pipeline_value > 0 else 0.0
        stage_breakdown.append(StageBreakdown(
            stage=row.stage,
            deal_count=int(row.deal_count),
            total_amount=float(row.total_amount),
            pct_of_pipeline=min(pct, 100.0),
        ))

    # ── Top 5 deals by amount ─────────────────────────────────────────────────
    top_q = db.query(ZohoDeal)
    top_q = apply_rls(top_q, current_user)
    top_deals_rows = (
        top_q
        .filter(ZohoDeal.stage.notin_(CLOSED_STAGES))
        .order_by(ZohoDeal.amount.desc())
        .limit(5)
        .all()
    )
    top_deals = [
        TopDealEntry(
            deal_id=str(d.id),
            deal_name=d.deal_name or "Unnamed",
            account_name=d.account_name or "Unknown",
            stage=d.stage or "Active",
            amount=float(d.amount or 0.0),
        )
        for d in top_deals_rows
    ]

    logger.info(
        f"Pipeline analytics for {current_user.email}: "
        f"pipeline={active_pipeline_value:.0f}, won={total_won_amount:.0f}, "
        f"win_rate={win_rate_pct}%, stages={len(stage_breakdown)}"
    )

    return PipelineAnalyticsResponse(
        active_pipeline_value=active_pipeline_value,
        total_won_amount=total_won_amount,
        win_rate_pct=win_rate_pct,
        at_risk_value=at_risk_value,
        at_risk_deal_count=at_risk_deal_count,
        closed_won_count=closed_won_count,
        closed_lost_count=closed_lost_count,
        other_stalled_count=other_stalled_count,
        stage_breakdown=stage_breakdown,
        top_deals=top_deals,
    )

