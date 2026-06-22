import re
import asyncio
import random
import httpx
import logging

logger = logging.getLogger(__name__)

BAILEYS_URL = "http://localhost:3000"


async def send_whatsapp_via_user_session(user_id: str, phone: str, message: str) -> bool:
    """
    Send a WhatsApp message via that specific user's own Baileys session.
    The user receives the message on their own WhatsApp number (self-notification).

    Args:
        user_id: CRM User UUID — identifies which Baileys session to use
        phone:   Recipient phone number (usually the same as the user's own number)
        message: Text message to send
    """
    if not user_id or not phone or not message:
        logger.warning("send_whatsapp_via_user_session: missing user_id, phone, or message.")
        return False

    # Normalise phone: strip non-digits, add Egypt country code if local
    sanitized = re.sub(r'\D', '', phone)
    if sanitized.startswith('01') and len(sanitized) == 11:
        sanitized = f'20{sanitized[1:]}'

    if not sanitized:
        logger.warning(f"Invalid phone number for user {user_id}: '{phone}'")
        return False

    # Anti-ban: random delay before sending
    delay = random.uniform(3.0, 10.0)
    logger.info(f"⏳ Anti-ban delay {delay:.1f}s before sending to {sanitized} (user {user_id})...")
    await asyncio.sleep(delay)

    payload = {"phone": sanitized, "message": message}

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{BAILEYS_URL}/send-message",
                params={"user_id": user_id},
                json=payload,
                timeout=20.0,
            )
            response.raise_for_status()

        logger.info(f"✅ WhatsApp sent to {sanitized} via user session {user_id}")
        return True

    except httpx.RequestError as e:
        logger.error(f"❌ Cannot reach Baileys microservice for user {user_id}: {e}")
        return False
    except httpx.HTTPStatusError as e:
        # 503 = user's WhatsApp not connected → log clearly
        if e.response.status_code == 503:
            logger.warning(
                f"⚠️ User {user_id} has not connected their WhatsApp yet. "
                f"They need to scan the QR code in Settings."
            )
        else:
            logger.error(f"❌ Baileys error for user {user_id}: {e.response.status_code} — {e.response.text}")
        return False
    except Exception as e:
        logger.error(f"❌ Unexpected error sending WhatsApp for user {user_id}: {e}")
        return False


def send_whatsapp_to_user(user_id: str, phone: str, message: str) -> bool:
    """
    Synchronous wrapper for send_whatsapp_via_user_session.
    Use this from background threads (APScheduler, threading.Thread).
    """
    try:
        return asyncio.run(send_whatsapp_via_user_session(user_id, phone, message))
    except RuntimeError:
        # Already inside an event loop
        loop = asyncio.get_running_loop()
        loop.create_task(send_whatsapp_via_user_session(user_id, phone, message))
        return True


# ── Legacy compatibility (kept so old call sites don't break) ─────────────────
async def send_whatsapp_alert_via_baileys(phone: str, message: str) -> bool:
    """
    DEPRECATED: single-session sender.
    New code should use send_whatsapp_via_user_session instead.
    Kept for backward compatibility with notification_service.py.
    """
    logger.warning("send_whatsapp_alert_via_baileys is deprecated. Use send_whatsapp_via_user_session.")
    return False


def send_headless_whatsapp(phone: str, message: str) -> bool:
    """DEPRECATED wrapper — kept for backward compatibility."""
    logger.warning("send_headless_whatsapp is deprecated. Use send_whatsapp_to_user.")
    return False
