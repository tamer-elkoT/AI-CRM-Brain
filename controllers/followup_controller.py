"""
Sprint 5: Follow-up Controller
Handles follow-up scheduling, marking deals as followed up,
Grok LLM message generation, and WhatsApp alerts.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
import logging
import httpx

from models.database import SessionLocal
from models.schema import (
    ZohoDeal, MLPrediction, LLMRecommendation,
    DealFollowup, FollowupLog, Notification, User,
)
from models.api_schemas import (
    FollowupMarkRequest,
    FollowupDaysUpdateRequest,
    GenerateMessageRequest,
    GenerateMessageResponse,
)
from config import settings
# Epic 1: import auth dependency so mark_followed_up can record the sales_rep_id
from controllers.auth_controller import get_current_user_dep, get_db

router = APIRouter()
logger = logging.getLogger(__name__)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


CLOSED_STAGES = ['Closed Won', 'Closed Lost']


# ============================================================
# Feature 3: Follow-up Scheduling
# ============================================================
@router.post("/followups/schedule")
def schedule_followups(db: Session = Depends(get_db)):
    """
    Evaluate all active deals and create follow-up records based on AI score.
    - Score >= 90%: immediate follow-up
    - Score < 90%: deferred follow-up (customizable days per deal)
    Called automatically after AI generation, or manually.
    """
    # Get all active deals with their latest recommendation
    deals_with_recs = (
        db.query(ZohoDeal, LLMRecommendation)
        .outerjoin(LLMRecommendation, ZohoDeal.id == LLMRecommendation.deal_id)
        .filter(ZohoDeal.stage.notin_(CLOSED_STAGES))
        .all()
    )

    scheduled_count = 0
    immediate_count = 0
    deferred_count = 0

    now = datetime.now(timezone.utc)

    for deal, rec in deals_with_recs:
        ai_score = rec.adjusted_score_pct if rec else 0.0

        # Skip deals already followed up or already scheduled
        if deal.action_status == "followed_up":
            continue

        # Check if there's already a pending (un-notified) follow-up
        existing = db.query(DealFollowup).filter(
            DealFollowup.deal_id == deal.id,
            DealFollowup.notified_at.is_(None),
        ).first()
        if existing:
            continue

        if ai_score >= 90:
            # Immediate follow-up
            followup = DealFollowup(
                deal_id=deal.id,
                scheduled_at=now,
                urgency="immediate",
                followup_days=0,
            )
            deal.action_status = "need_action_now"
            immediate_count += 1
        else:
            # Deferred follow-up (use deal's custom period or default 3 days)
            days = deal.followup_days_override or 3
            followup = DealFollowup(
                deal_id=deal.id,
                scheduled_at=now + timedelta(days=days),
                urgency="deferred",
                followup_days=days,
            )
            deal.action_status = "need_action_3days"
            deferred_count += 1

        db.add(followup)
        scheduled_count += 1

        # Create in-app notification for the deal owner
        if deal.owner_name:
            owner = db.query(User).filter(
                User.name == deal.owner_name,
                User.role == "Sales",
            ).first()
            if owner:
                urgency_text = "immediately" if ai_score >= 90 else f"in {deal.followup_days_override or 3} days"
                notification = Notification(
                    user_id=owner.id,
                    deal_id=deal.id,
                    type="follow_up_due",
                    title=f"Follow-up Required: {deal.deal_name}",
                    body=f"AI Score: {ai_score}%. Follow up {urgency_text}. Account: {deal.account_name or 'Unknown'}.",
                )
                db.add(notification)

    db.commit()

    return {
        "status": "success",
        "message": f"Scheduled {scheduled_count} follow-ups ({immediate_count} immediate, {deferred_count} deferred).",
        "scheduled": scheduled_count,
        "immediate": immediate_count,
        "deferred": deferred_count,
    }


# ============================================================
# Feature 3: Update follow-up days for a deal
# ============================================================
@router.patch("/followups/{deal_id}/days")
def update_followup_days(
    deal_id: str,
    request: FollowupDaysUpdateRequest,
    db: Session = Depends(get_db),
):
    """
    Let the sales rep customize the deferred follow-up period for a deal.
    """
    deal = db.query(ZohoDeal).filter(ZohoDeal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    if request.days < 1 or request.days > 90:
        raise HTTPException(status_code=400, detail="Days must be between 1 and 90")

    deal.followup_days_override = request.days

    # Update any pending deferred follow-up
    pending = db.query(DealFollowup).filter(
        DealFollowup.deal_id == deal_id,
        DealFollowup.urgency == "deferred",
        DealFollowup.notified_at.is_(None),
    ).first()
    if pending:
        pending.scheduled_at = pending.created_at + timedelta(days=request.days)
        pending.followup_days = request.days

    db.commit()

    return {
        "status": "success",
        "message": f"Follow-up period updated to {request.days} days for deal '{deal.deal_name}'.",
        "deal_id": deal_id,
        "days": request.days,
    }


# ============================================================
# Feature 7: Mark as Followed Up
# ============================================================
@router.post("/followups/{deal_id}/mark")
def mark_followed_up(
    deal_id: str,
    request: FollowupMarkRequest,
    db: Session = Depends(get_db),
    # Epic 1 fix: require auth so we can save the sales rep's user ID
    current_user: User = Depends(get_current_user_dep),
):
    """
    Record a follow-up action for a deal.
    Updates action_status, creates a followup_log entry.
    Epic 1: Now saves sales_rep_id from the authenticated user's JWT.
    """
    deal = db.query(ZohoDeal).filter(ZohoDeal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    # Epic 1 fix: pass current_user.id so sales_rep_id is never null
    log = FollowupLog(
        deal_id=deal_id,
        sales_rep_id=current_user.id,
        channel=request.channel,
        message_sent=request.message_sent,
        notes=request.notes,
    )
    db.add(log)

    # Update deal action status
    deal.action_status = "followed_up"

    # Mark any pending follow-ups as notified
    pending_followups = db.query(DealFollowup).filter(
        DealFollowup.deal_id == deal_id,
        DealFollowup.notified_at.is_(None),
    ).all()
    for fu in pending_followups:
        fu.notified_at = datetime.now(timezone.utc)

    # Create notification
    if deal.owner_name:
        owner = db.query(User).filter(User.name == deal.owner_name).first()
        if owner:
            notification = Notification(
                user_id=owner.id,
                deal_id=deal.id,
                type="deal_updated",
                title=f"Followed Up: {deal.deal_name}",
                body=f"Follow-up recorded via {request.channel}.",
            )
            db.add(notification)

    db.commit()

    # Get updated count
    followup_count = db.query(func.count(FollowupLog.id)).filter(
        FollowupLog.deal_id == deal_id
    ).scalar() or 0

    return {
        "status": "success",
        "message": f"Follow-up recorded for '{deal.deal_name}'.",
        "deal_id": deal_id,
        "followup_count": followup_count,
        "followed_up_at": str(log.followed_up_at),
    }


# ============================================================
# Feature 6: Grok LLM Client Message Generation
# ============================================================
@router.post("/followups/{deal_id}/generate-message", response_model=GenerateMessageResponse)
async def generate_client_message(
    deal_id: str,
    request: GenerateMessageRequest = None,
    db: Session = Depends(get_db),
):
    """
    Generate a personalized WhatsApp message for the client using Grok LLM.
    """
    deal = db.query(ZohoDeal).filter(ZohoDeal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    # Get latest recommendation for AI score
    rec = (
        db.query(LLMRecommendation)
        .filter(LLMRecommendation.deal_id == deal_id)
        .order_by(LLMRecommendation.created_at.desc())
        .first()
    )

    ai_score = rec.adjusted_score_pct if rec else 0.0
    sales_rep_name = (request.sales_rep_name if request and request.sales_rep_name
                      else deal.owner_name or "Sales Representative")

    # Build the Grok prompt
    prompt = f"""You are an expert B2B sales communication specialist. Generate a professional, warm, and concise WhatsApp message from a sales representative to a client.

Deal Context:
- Deal Name: {deal.deal_name}
- Account: {deal.account_name or 'N/A'}
- Stage: {deal.stage}
- Deal Amount: ${deal.amount or 0:,.0f}
- AI Win Probability: {ai_score}%
- Closing Date: {str(deal.closing_date)[:10] if deal.closing_date else 'N/A'}
- Sales Rep Name: {sales_rep_name}

Rules:
- Keep it under 120 words
- Warm but professional tone
- Reference the deal stage naturally
- Include a clear call-to-action (schedule a call, confirm next steps, etc.)
- Do NOT mention the AI score or internal data
- Format it ready to send as-is via WhatsApp"""

    try:
        # Call Grok API (xAI)
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.GROK_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.GROK_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.GROK_MODEL,
                    "messages": [
                        {"role": "system", "content": "You are an expert B2B sales communication specialist."},
                        {"role": "user", "content": prompt},
                    ],
                    "max_tokens": 300,
                    "temperature": 0.7,
                },
            )
            response.raise_for_status()
            data = response.json()
            generated_message = data["choices"][0]["message"]["content"].strip()

    except Exception as grok_e:
        logger.warning(f"Grok API failed ({grok_e}), falling back to Groq...")
        try:
            # Fallback to Groq
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{settings.LLM_BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.LLM_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": settings.LLM_MODEL_ID,
                        "messages": [
                            {"role": "system", "content": "You are an expert B2B sales communication specialist."},
                            {"role": "user", "content": prompt},
                        ],
                        "max_tokens": 300,
                        "temperature": 0.7,
                    },
                )
                response.raise_for_status()
                data = response.json()
                generated_message = data["choices"][0]["message"]["content"].strip()
        except Exception as groq_e:
            logger.error(f"Both Grok and Groq generation failed. Groq error: {groq_e}")
            raise HTTPException(status_code=500, detail=f"Message generation failed on both providers. Groq error: {str(groq_e)}")

    return GenerateMessageResponse(
        status="success",
        generated_message=generated_message,
        deal_name=deal.deal_name,
        account_name=deal.account_name or "Unknown",
        client_phone=deal.client_phone,
    )


# ============================================================
# Feature 5: WhatsApp Sales Rep Alert
# ============================================================
@router.post("/followups/{deal_id}/send-alert")
def send_whatsapp_alert_to_rep(
    deal_id: str,
    db: Session = Depends(get_db),
):
    """
    Send a WhatsApp notification to the assigned sales rep for a deal.
    Uses pywhatkit for free messaging.
    """
    deal = db.query(ZohoDeal).filter(ZohoDeal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    rec = (
        db.query(LLMRecommendation)
        .filter(LLMRecommendation.deal_id == deal_id)
        .order_by(LLMRecommendation.created_at.desc())
        .first()
    )

    ai_score = rec.adjusted_score_pct if rec else 0.0
    urgency = "Immediately" if ai_score >= 90 else f"in {deal.followup_days_override or 3} days"

    # Find the sales rep's phone number
    owner_phone = None
    rep_name = deal.owner_name or "Sales Rep"
    if deal.owner_name:
        owner = db.query(User).filter(
            User.name == deal.owner_name,
            User.is_whatsapp_verified == True,
        ).first()
        if owner and owner.phone_number:
            owner_phone = owner.phone_number

    if not owner_phone:
        return {
            "status": "skipped",
            "message": f"No verified WhatsApp number found for '{rep_name}'.",
            "deal_id": deal_id,
        }

    # Build the alert message per Feature 5 spec
    deal_link = f"{settings.APP_BASE_URL}/home?deal={deal_id}"
    message = (
        f"Hi, {rep_name} 👋\n\n"
        f"📋 Deal Alert: {deal.deal_name}\n"
        f"👤 Client: {deal.account_name or 'N/A'}\n"
        f"📞 Phone: {deal.client_phone or 'N/A'}\n"
        f"📧 Email: {deal.client_email or 'N/A'}\n"
        f"🔄 Stage: {deal.stage}\n"
        f"🏆 AI Score: {ai_score}%\n\n"
        f"⚡ Follow up {urgency} — this deal has a {ai_score}% probability of closing.\n\n"
        f"Open AI CRM Brain → {deal_link}"
    )

    # Try pywhatkit for direct messaging
    try:
        import pywhatkit
        sanitized = "".join(c for c in owner_phone if c.isdigit() or c == "+")
        if not sanitized.startswith("+"):
            sanitized = f"+{sanitized}"
        # sendwhatmsg_instantly sends immediately without waiting
        pywhatkit.sendwhatmsg_instantly(sanitized, message, wait_time=10, tab_close=True)
        logger.info(f"WhatsApp alert sent to {rep_name} ({sanitized}) for deal {deal.deal_name}")

        return {
            "status": "sent",
            "message": f"WhatsApp alert sent to {rep_name}.",
            "deal_id": deal_id,
        }
    except Exception as e:
        logger.warning(f"pywhatkit failed: {e}. Falling back to wa.me link.")
        # Fallback: return wa.me link for manual sending
        import urllib.parse
        encoded = urllib.parse.quote(message)
        sanitized = "".join(c for c in owner_phone if c.isdigit())
        wa_link = f"https://wa.me/{sanitized}?text={encoded}"

        return {
            "status": "fallback",
            "message": f"Could not send automatically. Use the WhatsApp link.",
            "deal_id": deal_id,
            "wa_link": wa_link,
        }
