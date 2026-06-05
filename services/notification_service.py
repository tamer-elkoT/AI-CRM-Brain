"""
Notification Service for AI CRM Brain.
Handles WhatsApp and SMS alerts to sales reps for urgent/hot deals.

In production, replace the mock functions with real Twilio/Meta WhatsApp API calls.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)


def send_whatsapp_otp(phone: str, otp_code: str) -> dict:
    """
    Send a 6-digit OTP to a phone number via WhatsApp.

    Args:
        phone: The user's phone number (with country code, e.g. "+966501234567")
        otp_code: The 6-digit OTP string

    In production, this would call the Twilio/Meta WhatsApp Business API:
        client = Client(TWILIO_SID, TWILIO_AUTH_TOKEN)
        message = client.messages.create(
            from_='whatsapp:+14155238886',
            body=message_body,
            to=f'whatsapp:{phone}'
        )
    """
    sanitized_phone = "".join(c for c in phone if c.isdigit()) if phone else "N/A"

    message_body = (
        f"🔐 *AI CRM Brain — Verification Code*\n"
        f"━━━━━━━━━━━━━━━━━━━\n"
        f"Your one-time verification code is:\n\n"
        f"    *{otp_code}*\n\n"
        f"This code expires in 10 minutes.\n"
        f"━━━━━━━━━━━━━━━━━━━\n"
        f"If you didn't request this code, please ignore this message."
    )

    # ─── MOCK: Log the OTP for local development ───
    logger.warning(
        "\n"
        "╔══════════════════════════════════════════════════════════════╗\n"
        f"║  🔐 WhatsApp OTP → +{sanitized_phone}                      \n"
        "╠══════════════════════════════════════════════════════════════╣\n"
        f"║  OTP Code: {otp_code}                                       \n"
        "╠══════════════════════════════════════════════════════════════╣\n"
        f"{message_body}\n"
        "╚══════════════════════════════════════════════════════════════╝"
    )

    # TODO: In production, uncomment and configure:
    # from twilio.rest import Client
    # client = Client(os.getenv("TWILIO_SID"), os.getenv("TWILIO_AUTH_TOKEN"))
    # client.messages.create(
    #     from_=f'whatsapp:{os.getenv("TWILIO_WHATSAPP_FROM")}',
    #     body=message_body,
    #     to=f'whatsapp:+{sanitized_phone}'
    # )

    return {
        "status": "sent",
        "to": sanitized_phone,
        "message_type": "otp",
    }


def send_whatsapp_alert(
    rep_phone: str,
    rep_name: str,
    deal_name: str,
    account_name: str,
    amount: float,
    ai_probability: float,
    alert_type: str,
    recommendation_ar: str = "",
):
    """
    Send a WhatsApp notification to a sales rep about a deal that needs attention.

    Args:
        rep_phone: The sales rep's phone number (with country code)
        rep_name: Name of the deal owner / sales rep
        deal_name: Name of the deal
        account_name: Name of the client account
        amount: Deal amount in USD
        ai_probability: AI-adjusted win probability (0.0–1.0)
        alert_type: "RISK" or "HOT_LEAD"
        recommendation_ar: Arabic AI recommendation text

    In production, this would call the Twilio/Meta WhatsApp Business API:
        client = Client(TWILIO_SID, TWILIO_AUTH_TOKEN)
        message = client.messages.create(
            from_='whatsapp:+14155238886',
            body=message_body,
            to=f'whatsapp:+{rep_phone}'
        )
    """
    sanitized_phone = "".join(c for c in rep_phone if c.isdigit()) if rep_phone else "N/A"

    if alert_type == "RISK":
        emoji = "🚨"
        header = "URGENT: Deal at Risk"
        action = "Immediate intervention required — contact the client NOW."
    elif alert_type == "HOT_LEAD":
        emoji = "🔥"
        header = "HOT LEAD: Ready to Close"
        action = "Follow up immediately to close this deal!"
    else:
        emoji = "📋"
        header = "Deal Update"
        action = "Please review this deal."

    message_body = (
        f"{emoji} *{header}*\n"
        f"━━━━━━━━━━━━━━━━━━━\n"
        f"📌 *Deal:* {deal_name}\n"
        f"🏢 *Account:* {account_name}\n"
        f"💰 *Amount:* ${amount:,.0f}\n"
        f"🎯 *AI Probability:* {ai_probability:.0%}\n"
        f"━━━━━━━━━━━━━━━━━━━\n"
        f"⚡ *Action:* {action}\n"
    )

    if recommendation_ar:
        message_body += f"\n🧠 *AI توصية:* {recommendation_ar[:120]}\n"

    # ─── MOCK: Log the WhatsApp message ───
    logger.warning(
        "\n"
        "╔══════════════════════════════════════════════════════════════╗\n"
        f"║  {emoji} WhatsApp Alert → {rep_name} (+{sanitized_phone})     \n"
        "╠══════════════════════════════════════════════════════════════╣\n"
        f"{message_body}"
        "╚══════════════════════════════════════════════════════════════╝"
    )

    # Send message using pywhatkit if phone is available, with webbrowser fallback
    if sanitized_phone and sanitized_phone != "N/A":
        phone_to_use = f"+{sanitized_phone}" if not sanitized_phone.startswith("+") else sanitized_phone
        sent = False

        # Attempt 1: pywhatkit
        try:
            import pywhatkit
            pywhatkit.sendwhatmsg_instantly(phone_to_use, message_body, wait_time=15, tab_close=True)
            logger.info(f"Sent pywhatkit WhatsApp alert to {rep_name} ({phone_to_use})")
            sent = True
        except Exception as e:
            logger.warning(f"pywhatkit failed for {rep_name} ({phone_to_use}): {e}")

        # Attempt 2: webbrowser fallback (opens WhatsApp Web in default browser)
        if not sent:
            try:
                import platform
                import subprocess
                import webbrowser
                from urllib.parse import quote
                
                wa_url = f"https://wa.me/{sanitized_phone}?text={quote(message_body)}"
                
                if 'microsoft' in platform.uname().release.lower():
                    safe_link = wa_url.replace('&', '^&')
                    subprocess.run(['cmd.exe', '/c', 'start', '""', safe_link], stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL)
                else:
                    webbrowser.open(wa_url)
                    
                logger.info(f"Opened WhatsApp Web fallback for {rep_name} ({phone_to_use})")
            except Exception as e2:
                logger.error(f"Both pywhatkit and webbrowser failed for {rep_name}: {e2}")
    else:
        logger.warning(f"Cannot send WhatsApp alert to {rep_name}: no valid phone number")

    return {
        "status": "sent",
        "to": sanitized_phone,
        "alert_type": alert_type,
        "deal_name": deal_name,
    }


def evaluate_and_notify(
    deal_name: str,
    account_name: str,
    amount: float,
    adjusted_probability: float,
    risk_flag: Optional[str],
    owner_name: str,
    owner_phone: Optional[str],
    recommendation_ar: str = "",
):
    """
    Evaluate a deal after recommendation generation and send WhatsApp alerts
    if the deal matches Risk or Hot Lead criteria.

    Criteria:
      - RISK:     amount >= 50000 AND probability < 0.45, or risk_flag in HIGH_RISK/STALLED
      - HOT_LEAD: probability > 0.85
    """
    if not owner_phone:
        logger.info(f"Skipping WhatsApp alert for '{deal_name}' — no phone for owner '{owner_name}'")
        return None

    # Risk deals: high amount + low probability
    is_risk = (
        (amount >= 50000 and adjusted_probability < 0.45) or
        (risk_flag in ("HIGH_RISK", "STALLED", "COMPETITOR_PRESENT"))
    )

    # Hot leads: high probability deals ready to close
    is_hot = adjusted_probability > 0.85

    if is_risk:
        return send_whatsapp_alert(
            rep_phone=owner_phone,
            rep_name=owner_name,
            deal_name=deal_name,
            account_name=account_name,
            amount=amount,
            ai_probability=adjusted_probability,
            alert_type="RISK",
            recommendation_ar=recommendation_ar,
        )
    elif is_hot:
        return send_whatsapp_alert(
            rep_phone=owner_phone,
            rep_name=owner_name,
            deal_name=deal_name,
            account_name=account_name,
            amount=amount,
            ai_probability=adjusted_probability,
            alert_type="HOT_LEAD",
            recommendation_ar=recommendation_ar,
        )

    return None
