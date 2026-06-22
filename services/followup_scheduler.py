"""
Sprint 5: Background Follow-up Scheduler
Runs periodically to check for follow-ups that are due and sends
WhatsApp self-notifications via each sales rep's OWN connected session.

Architecture:
  - Each CRM user scans QR once → their own Baileys session is created
  - When their deal needs follow-up, the scheduler sends a message
    FROM their own WhatsApp TO their own number (self-message)
  - They receive only their own deal alerts
"""

import logging
from datetime import datetime, timezone

from models.database import SessionLocal
from models.schema import DealFollowup, ZohoDeal, Notification, User, LLMRecommendation

logger = logging.getLogger(__name__)


def check_deferred_followups():
    """
    Check for due follow-ups (immediate or deferred) that haven't been notified yet.
    For each:
      1. Create an in-app notification for the deal owner
      2. Send a WhatsApp self-message via the owner's connected session
      3. Mark the follow-up as notified
    """
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)

        # Find all due follow-ups (both immediate and deferred, unnotified)
        due_followups = (
            db.query(DealFollowup, ZohoDeal)
            .join(ZohoDeal, DealFollowup.deal_id == ZohoDeal.id)
            .filter(
                DealFollowup.notified_at.is_(None),
                DealFollowup.scheduled_at <= now,
                DealFollowup.urgency.in_(["deferred", "immediate"]),
            )
            .all()
        )

        if not due_followups:
            logger.debug("No follow-ups due right now.")
            return

        logger.info(f"Found {len(due_followups)} follow-up(s) due.")

        for followup, deal in due_followups:
            try:
                # Update deal action status
                deal.action_status = "need_action_now"

                # Get latest AI score
                rec = (
                    db.query(LLMRecommendation)
                    .filter(LLMRecommendation.deal_id == deal.id)
                    .order_by(LLMRecommendation.created_at.desc())
                    .first()
                )
                ai_score = rec.adjusted_score_pct if rec else 0.0

                # Find ALL users matching this deal owner name
                owner = None
                if deal.owner_name:
                    candidates = (
                        db.query(User)
                        .filter(User.name.ilike(deal.owner_name))
                        .all()
                    )
                    if candidates:
                        # Prefer the candidate who has an active WhatsApp session
                        owner = _find_connected_user(candidates)
                        if not owner:
                            logger.warning(
                                f"Found {len(candidates)} user(s) named '{deal.owner_name}' "
                                f"but none have connected WhatsApp. "
                                f"Ask them to scan QR in Settings."
                            )
                            owner = candidates[0]  # fall back to first


                if owner:
                    # 1. Create in-app notification
                    notification = Notification(
                        user_id=owner.id,
                        deal_id=deal.id,
                        type="follow_up_due",
                        title=f"⏰ Follow-up Due: {deal.deal_name}",
                        body=(
                            f"The {followup.followup_days}-day grace period has ended. "
                            f"AI Score: {ai_score:.0f}%. "
                            f"Account: {deal.account_name or 'Unknown'}. "
                            f"Follow up now!"
                        ),
                    )
                    db.add(notification)

                    # 2. Send WhatsApp via owner's own session
                    if owner.phone_number:
                        _send_whatsapp_self_notification(
                            user_id=str(owner.id),
                            phone=owner.phone_number,
                            rep_name=owner.name or deal.owner_name,
                            deal=deal,
                            ai_score=ai_score,
                        )
                    else:
                        logger.warning(
                            f"Owner '{deal.owner_name}' has no phone number — "
                            f"in-app notification created but WhatsApp skipped."
                        )
                else:
                    logger.warning(
                        f"No CRM user found matching owner_name='{deal.owner_name}' "
                        f"for deal '{deal.deal_name}'. "
                        f"Make sure the rep signed up with their exact Zoho name."
                    )

                # 3. Mark as notified
                followup.notified_at = now
                logger.info(f"✓ Processed follow-up for deal '{deal.deal_name}'")

            except Exception as e:
                logger.error(f"Error processing follow-up for deal {deal.id}: {e}")
                continue

        db.commit()
        logger.info(f"✅ Processed {len(due_followups)} follow-up(s).")

    except Exception as e:
        logger.error(f"Follow-up scheduler error: {e}")
        db.rollback()
    finally:
        db.close()


def _send_whatsapp_self_notification(
    user_id: str,
    phone: str,
    rep_name: str,
    deal,
    ai_score: float,
):
    """
    Send a WhatsApp notification to the rep via their OWN connected session.
    The message goes FROM their linked WhatsApp TO themselves — a self-message
    that only they see.
    """
    try:
        from config import settings

        deal_link = f"{settings.APP_BASE_URL}/home?deal={deal.id}"

        message = (
            f"Hi {rep_name} 👋\n\n"
            f"⏰ *Follow-up Alert* — AI CRM Brain\n"
            f"━━━━━━━━━━━━━━━━━━━\n"
            f"📋 *Deal:* {deal.deal_name}\n"
            f"👤 *Client:* {deal.account_name or 'N/A'}\n"
            f"📞 *Phone:* {deal.client_phone or 'N/A'}\n"
            f"🔄 *Stage:* {deal.stage}\n"
            f"🏆 *AI Score:* {ai_score:.0f}%\n"
            f"━━━━━━━━━━━━━━━━━━━\n"
            f"⚡ Action required — follow up NOW!\n\n"
            f"Open AI CRM Brain → {deal_link}"
        )

        from utils.whatsapp_sender import send_whatsapp_to_user
        sent = send_whatsapp_to_user(user_id, phone, message)

        if sent:
            logger.info(f"✅ WhatsApp self-notification sent to {rep_name} (user {user_id})")
        else:
            logger.warning(
                f"⚠️ Could not send WhatsApp to {rep_name}. "
                f"They may not have scanned their QR code yet in Settings."
            )
    except Exception as e:
        logger.error(f"Error in _send_whatsapp_self_notification: {e}")


def _find_connected_user(candidates):
    """
    Given a list of User objects with the same name, return the one whose
    WhatsApp session is currently active (connected) in the Baileys microservice.

    Queries GET /sessions to get all active sessions, then matches by user ID.
    Falls back to None if microservice is unreachable or no session is active.
    """
    import requests as _req
    try:
        resp = _req.get("http://localhost:3000/sessions", timeout=3.0)
        sessions = resp.json()  # { userId: { connected, phone, has_qr }, ... }
        for user in candidates:
            uid = str(user.id)
            session = sessions.get(uid)
            if session and session.get("connected"):
                logger.debug(f"_find_connected_user: matched {user.name} via session {uid}")
                return user
        return None
    except Exception as e:
        logger.debug(f"_find_connected_user: could not reach Baileys ({e}), falling back")
        return None

