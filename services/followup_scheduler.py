"""
Sprint 5: Background Follow-up Scheduler
Runs periodically to check for deferred follow-ups that are due
and triggers WhatsApp notifications + in-app notifications.
"""

import logging
from datetime import datetime, timezone

from models.database import SessionLocal
from models.schema import DealFollowup, ZohoDeal, Notification, User, LLMRecommendation

logger = logging.getLogger(__name__)


def check_deferred_followups():
    """
    Check for deferred follow-ups where scheduled_at <= NOW() and notified_at IS NULL.
    For each due follow-up:
    1. Create an in-app notification
    2. Attempt to send a WhatsApp alert via pywhatkit
    3. Mark the follow-up as notified
    """
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)

        # Find all due follow-ups
        due_followups = (
            db.query(DealFollowup, ZohoDeal)
            .join(ZohoDeal, DealFollowup.deal_id == ZohoDeal.id)
            .filter(
                DealFollowup.notified_at.is_(None),
                DealFollowup.scheduled_at <= now,
                DealFollowup.urgency == "deferred",
            )
            .all()
        )

        if not due_followups:
            logger.debug("No deferred follow-ups due.")
            return

        logger.info(f"Found {len(due_followups)} deferred follow-ups due.")

        for followup, deal in due_followups:
            try:
                # Update deal action status to immediate action needed
                deal.action_status = "need_action_now"

                # Get AI score for the notification
                rec = (
                    db.query(LLMRecommendation)
                    .filter(LLMRecommendation.deal_id == deal.id)
                    .order_by(LLMRecommendation.created_at.desc())
                    .first()
                )
                ai_score = rec.adjusted_score_pct if rec else 0.0

                # Find the deal owner
                if deal.owner_name:
                    owner = db.query(User).filter(
                        User.name.ilike(deal.owner_name)
                    ).first()

                    if owner:
                        # Create in-app notification
                        notification = Notification(
                            user_id=owner.id,
                            deal_id=deal.id,
                            type="follow_up_due",
                            title=f"⏰ Follow-up Due: {deal.deal_name}",
                            body=(
                                f"The {followup.followup_days}-day grace period has ended. "
                                f"AI Score: {ai_score}%. "
                                f"Account: {deal.account_name or 'Unknown'}. "
                                f"Follow up now!"
                            ),
                        )
                        db.add(notification)

                        # Try to send WhatsApp alert
                        if owner.phone_number:
                            _send_deferred_whatsapp(
                                phone=owner.phone_number,
                                rep_name=owner.name or deal.owner_name,
                                deal=deal,
                                ai_score=ai_score,
                            )

                # Mark follow-up as notified
                followup.notified_at = now
                logger.info(f"Processed deferred follow-up for deal '{deal.deal_name}'")

            except Exception as e:
                logger.error(f"Error processing follow-up for deal {deal.id}: {e}")
                continue

        db.commit()
        logger.info(f"Processed {len(due_followups)} deferred follow-ups.")

    except Exception as e:
        logger.error(f"Follow-up scheduler error: {e}")
        db.rollback()
    finally:
        db.close()


def _send_deferred_whatsapp(phone: str, rep_name: str, deal, ai_score: float):
    """Attempt to send a WhatsApp alert for a deferred follow-up."""
    try:
        from config import settings
        deal_link = f"{settings.APP_BASE_URL}/home?deal={deal.id}"

        message = (
            f"Hi, {rep_name} 👋\n\n"
            f"📋 Deal Alert: {deal.deal_name}\n"
            f"👤 Client: {deal.account_name or 'N/A'}\n"
            f"📞 Phone: {deal.client_phone or 'N/A'}\n"
            f"📧 Email: {deal.client_email or 'N/A'}\n"
            f"🔄 Stage: {deal.stage}\n"
            f"🏆 AI Score: {ai_score}%\n\n"
            f"⚡ Follow up now — the grace period has ended.\n\n"
            f"Open AI CRM Brain → {deal_link}"
        )

        from utils.whatsapp_sender import send_headless_whatsapp
        sent = send_headless_whatsapp(phone, message)
        if sent:
            logger.info(f"✅ Headless deferred WhatsApp alert sent to {rep_name}")
        else:
            logger.warning(f"⚠️ Failed to send headless deferred alert to {rep_name}. Check Twilio credentials or limits.")
    except Exception as e:
        logger.error(f"Error in _send_deferred_whatsapp: {e}")
