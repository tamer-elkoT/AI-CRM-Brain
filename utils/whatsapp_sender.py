import os
import requests
import urllib.parse
import logging

logger = logging.getLogger(__name__)

def send_headless_whatsapp(phone: str, message: str) -> bool:
    """
    Sends a truly headless automated WhatsApp message using the Twilio API.
    Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_NUMBER in the environment.
    """
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    from_number = os.getenv("TWILIO_WHATSAPP_NUMBER")
    
    if not all([account_sid, auth_token, from_number]):
        logger.warning("Twilio credentials are not fully set in .env. Cannot send headless WhatsApp alert.")
        return False
        
    if not phone:
        logger.warning("No phone number provided for WhatsApp alert.")
        return False

    # Format phone number: remove any non-digit characters except +
    sanitized_phone = "".join(c for c in phone if c.isdigit() or c == "+")
    
    # Handle Egyptian local numbers (010, 011, 012, 015)
    if sanitized_phone.startswith("01") and len(sanitized_phone) == 11:
        sanitized_phone = f"+20{sanitized_phone[1:]}"
    elif not sanitized_phone.startswith("+"):
        sanitized_phone = f"+{sanitized_phone}"
        
    try:
        from twilio.rest import Client
        from twilio.base.exceptions import TwilioRestException
        client = Client(account_sid, auth_token)

        message_obj = client.messages.create(
            body=message,
            from_=f"whatsapp:{from_number}",
            to=f"whatsapp:{sanitized_phone}"
        )

        logger.info(f"✅ Headless WhatsApp alert sent to {sanitized_phone} via Twilio. SID: {message_obj.sid}")
        return True

    except TwilioRestException as e:
        # ── Epic 4: Twilio rate-limit graceful degradation ──────────────────
        # Twilio free-tier: 5 messages/day. On 429 / 20429 → fall back to wa.me
        if e.status == 429 or e.code == 20429:
            encoded_msg = urllib.parse.quote(message[:300])
            fallback_url = f"https://wa.me/{sanitized_phone.lstrip('+')}?text={encoded_msg}"
            logger.warning(
                f"⚠️  Twilio rate limit hit (429). Falling back to wa.me deep link.\n"
                f"   Fallback URL: {fallback_url}"
            )
        else:
            logger.error(f"❌ Twilio API error (status={e.status}, code={e.code}): {e.msg}")
        return False

    except Exception as e:
        logger.error(f"❌ Failed to reach Twilio API: {e}")
        return False
