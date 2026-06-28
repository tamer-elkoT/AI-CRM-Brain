"""
Sprint 5: Deal Classifier Service
Evaluates ALL active deals and applies action labels, creates notifications,
and logs WhatsApp alerts. Called after Sync, Generate AI, and by the scheduler.
"""

import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func

from models.schema import (
    ZohoDeal, LLMRecommendation, DealFollowup,
    FollowupLog, Notification, User,
)

logger = logging.getLogger(__name__)

CLOSED_STAGES = ['Closed Won', 'Closed Lost']


def classify_all_deals(db: Session) -> dict:
    """
    Evaluate ALL active deals and:
    1. Set action_status based on AI score (≥90% → need_action_now, <90% → need_action_3days)
    2. Upsert DealFollowup records
    3. Create in-app Notification for the deal owner
    4. Log WhatsApp alert info to console (wa.me fallback)

    Returns summary dict with counts.
    """
    now = datetime.now(timezone.utc)

    # ── Subquery: get the LATEST recommendation per deal ──
    latest_rec_subq = (
        db.query(
            LLMRecommendation.deal_id,
            func.max(LLMRecommendation.created_at).label("max_created"),
        )
        .group_by(LLMRecommendation.deal_id)
        .subquery()
    )

    # ── Main query: all active deals with their latest recommendation ──
    deals_recs = (
        db.query(ZohoDeal, LLMRecommendation)
        .outerjoin(
            latest_rec_subq,
            ZohoDeal.id == latest_rec_subq.c.deal_id,
        )
        .outerjoin(
            LLMRecommendation,
            (LLMRecommendation.deal_id == latest_rec_subq.c.deal_id)
            & (LLMRecommendation.created_at == latest_rec_subq.c.max_created),
        )
        .filter(ZohoDeal.stage.notin_(CLOSED_STAGES))
        .all()
    )

    classified = 0
    immediate_count = 0
    deferred_count = 0
    notif_count = 0
    wa_count = 0

    for deal, rec in deals_recs:
        ai_score = rec.adjusted_score_pct if rec else 0.0

        # Skip deals already followed up by the sales rep
        if deal.action_status == "followed_up":
            continue

        # Skip deals with no AI score yet (no recommendation generated)
        if not rec:
            continue

        # ── Determine urgency ──
        if ai_score >= 90:
            new_status = "need_action_now"
            urgency = "immediate"
            followup_days = 0
            scheduled_at = now
            immediate_count += 1
        else:
            new_status = "need_action_3days"
            urgency = "deferred"
            followup_days = deal.followup_days_override or 3
            scheduled_at = now + timedelta(days=followup_days)
            deferred_count += 1

        # ── Check if status actually changed ──
        old_status = deal.action_status or "no_action"
        status_changed = old_status != new_status

        # Always update action_status
        deal.action_status = new_status

        # ── Upsert DealFollowup: delete stale pending + create new ──
        if status_changed:
            # Remove any old pending (un-notified) followup for this deal
            db.query(DealFollowup).filter(
                DealFollowup.deal_id == deal.id,
                DealFollowup.notified_at.is_(None),
            ).delete()

            # Create new followup record
            fu = DealFollowup(
                deal_id=deal.id,
                scheduled_at=scheduled_at,
                urgency=urgency,
                followup_days=followup_days,
            )
            db.add(fu)
        else:
            # Even if status didn't change, ensure a followup exists
            existing = db.query(DealFollowup).filter(
                DealFollowup.deal_id == deal.id,
                DealFollowup.notified_at.is_(None),
            ).first()
            if not existing:
                fu = DealFollowup(
                    deal_id=deal.id,
                    scheduled_at=scheduled_at,
                    urgency=urgency,
                    followup_days=followup_days,
                )
                db.add(fu)

        classified += 1

        # ── Create in-app notification (only if status changed) ──
        if status_changed and deal.owner_name:
            # More forgiving match: case insensitive, and handles if user just put "Tamer" instead of "Tamer Elkot"
            search_name = deal.owner_name.split(" ")[0].lower() # e.g. "tamer"
            
            owners = db.query(User).filter(
                func.lower(User.name).contains(search_name)
            ).all()
            
            # DEV FALLBACK: If no user matches the deal owner name at all, give the notification to the FIRST user in the DB
            # so that it at least shows up in the UI for testing.
            if not owners:
                first_user = db.query(User).first()
                if first_user:
                    owners = [first_user]
            
            if owners:
                urgency_text = "immediately ⚡" if urgency == "immediate" else f"in {followup_days} days 📅"
                
                # Create notification for ALL matching users to handle duplicate accounts (e.g. OAuth + Email)
                for owner in owners:
                    notification = Notification(
                        user_id=owner.id,
                        deal_id=deal.id,
                        type="follow_up_due",
                        title=f"{'🔴' if urgency == 'immediate' else '🟡'} Follow-up: {deal.deal_name}",
                        body=(
                            f"AI Score: {ai_score}%. Follow up {urgency_text}. "
                            f"Account: {deal.account_name or 'Unknown'}. "
                            f"Amount: ${deal.amount or 0:,.0f}."
                        ),
                    )
                    db.add(notification)
                    notif_count += 1

                # ── Log WhatsApp alert ──
                if urgency == "immediate":
                    # Pick the owner that actually has a phone number
                    owner_with_phone = next((o for o in owners if o.phone_number), owners[0])
                    _log_whatsapp_alert(deal, ai_score, owner_with_phone)
                    wa_count += 1

    db.commit()

    logger.info(
        f"✅ classify_all_deals: {classified} deals classified "
        f"({immediate_count} immediate, {deferred_count} deferred), "
        f"{notif_count} notifications created, {wa_count} WhatsApp alerts logged."
    )

    return {
        "classified": classified,
        "immediate": immediate_count,
        "deferred": deferred_count,
        "notifications_created": notif_count,
        "whatsapp_alerts": wa_count,
    }


def _log_whatsapp_alert(deal: ZohoDeal, ai_score: float, owner: User):
    """
    Log a WhatsApp alert for the sales rep. Uses wa.me link fallback
    since WhatsApp Cloud API is not configured.
    """
    rep_phone = owner.phone_number if owner else None
    rep_name = owner.name if owner else "Sales Rep"

    message = (
        f"Hi, {rep_name} 👋\n\n"
        f"📋 *Deal Alert: {deal.deal_name}*\n"
        f"👤 Client: {deal.account_name or 'N/A'}\n"
        f"📞 Phone: {deal.client_phone or 'N/A'}\n"
        f"📧 Email: {deal.client_email or 'N/A'}\n"
        f"🔄 Stage: {deal.stage}\n"
        f"🏆 AI Score: {ai_score}%\n\n"
        f"Follow up *IMMEDIATELY ⚡* — this deal has a {ai_score}% probability of closing.\n\n"
        f"Open AI CRM Brain → http://localhost:5173/home"
    )

    if rep_phone and owner:
        from utils.whatsapp_sender import send_whatsapp_to_user
        sent = send_whatsapp_to_user(str(owner.id), rep_phone, message)
        if sent:
            logger.info(f"✅ Automatic WhatsApp alert successfully sent to {rep_name}")
        else:
            logger.warning(f"⚠️ Failed to send WhatsApp alert to {rep_name}. Check Baileys connection.")
    else:
        logger.warning(
            f"[WA ALERT] ⚠️ No phone for rep '{rep_name}' on deal '{deal.deal_name}' — skipping WhatsApp alert. "
            f"Update the user's phone_number in the users table."
        )
