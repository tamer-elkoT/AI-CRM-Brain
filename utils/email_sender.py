"""
utils/email_sender.py — Hardened SMTP Email Utility
Supports Gmail (App Password), Outlook, and custom SMTP servers.

Gmail Setup:
  1. Enable 2-Step Verification: https://myaccount.google.com/security
  2. Generate an App Password: https://myaccount.google.com/apppasswords
     - Select "Mail" + "Other (Custom name)" → enter "AI CRM Brain"
  3. Copy the 16-character App Password into your .env:
       SMTP_USERNAME=your_gmail@gmail.com
       SMTP_PASSWORD=xxxx xxxx xxxx xxxx   ← the App Password (spaces are ok)
       SMTP_SERVER=smtp.gmail.com
       SMTP_PORT=587

Outlook/Hotmail Setup:
  SMTP_SERVER=smtp-mail.outlook.com
  SMTP_PORT=587
  SMTP_USERNAME=your_email@outlook.com
  SMTP_PASSWORD=your_regular_password
"""

import smtplib
import socket
import logging
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from smtplib import SMTPAuthenticationError, SMTPConnectError, SMTPRecipientsRefused

logger = logging.getLogger(__name__)


def send_invite_email(
    to_email: str,
    invite_link: str,
    role: str,
    company_name: str,
) -> dict:
    """
    Sends an invite email via SMTP.
    Returns a status dict: {"status": "sent"|"mocked"|"failed", "error": None | str}

    If SMTP env vars are missing, falls back to logging (mock mode) — great for dev.
    """
    smtp_server   = os.getenv("SMTP_SERVER", "")
    smtp_port     = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = os.getenv("SMTP_USERNAME", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    smtp_from     = os.getenv("SMTP_FROM", smtp_username or "noreply@aicrmbrain.com")

    role_display = role.replace("_", " ").title()
    subject = f"You're invited to join {company_name} on AI CRM Brain"

    # ── HTML body (professional invite email) ──────────────────────────────
    html_body = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f9fafb; margin:0; padding:0; }}
    .container {{ max-width:600px; margin:40px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.08); }}
    .header {{ background:linear-gradient(135deg,#006a61,#4a9e95); padding:32px 40px; color:#fff; }}
    .header h1 {{ margin:0; font-size:22px; font-weight:700; }}
    .header p {{ margin:6px 0 0; opacity:.85; font-size:14px; }}
    .body {{ padding:32px 40px; color:#1a1a1a; }}
    .body p {{ line-height:1.6; color:#444; margin:0 0 16px; }}
    .role-badge {{ display:inline-block; background:#006a6115; color:#006a61; border:1px solid #006a6130; border-radius:20px; padding:4px 14px; font-size:13px; font-weight:600; margin-bottom:20px; }}
    .btn {{ display:block; width:fit-content; margin:24px 0; background:#006a61; color:#fff !important; text-decoration:none; padding:14px 28px; border-radius:8px; font-weight:600; font-size:15px; }}
    .fallback {{ background:#f3f4f6; border-radius:6px; padding:12px 16px; font-size:12px; color:#555; word-break:break-all; margin-top:12px; }}
    .footer {{ padding:20px 40px; border-top:1px solid #f0f0f0; color:#999; font-size:12px; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🧠 AI CRM Brain</h1>
      <p>Your AI-powered Sales Intelligence Platform</p>
    </div>
    <div class="body">
      <p>Hello,</p>
      <p>You've been invited to join the <strong>{company_name}</strong> workspace as:</p>
      <span class="role-badge">{role_display}</span>
      <p>Click the button below to accept your invitation and set up your account:</p>
      <a href="{invite_link}" class="btn">Accept Invitation &rarr;</a>
      <p style="font-size:13px;color:#777;">If the button doesn't work, copy and paste this link into your browser:</p>
      <div class="fallback">{invite_link}</div>
      <p style="margin-top:24px;font-size:13px;color:#999;">This invitation expires in <strong>48 hours</strong>. If you didn't expect this, you can safely ignore it.</p>
    </div>
    <div class="footer">
      Sent by AI CRM Brain &bull; {company_name}
    </div>
  </div>
</body>
</html>
"""

    plain_body = (
        f"Hello,\n\n"
        f"You've been invited to join {company_name} on AI CRM Brain as a {role_display}.\n\n"
        f"Accept your invitation here:\n{invite_link}\n\n"
        f"This link expires in 48 hours.\n\n"
        f"If you didn't expect this, please ignore this email.\n\n"
        f"— AI CRM Brain"
    )

    # ── Mock mode — SMTP credentials not configured ──────────────────────────
    if not all([smtp_server, smtp_username, smtp_password]):
        logger.warning(
            "⚠️  SMTP credentials not configured. Falling back to mock email mode.\n"
            f"   TO: {to_email}\n"
            f"   SUBJECT: {subject}\n"
            f"   MAGIC LINK: {invite_link}\n"
            "   → Set SMTP_SERVER, SMTP_USERNAME, SMTP_PASSWORD in .env to send real emails."
        )
        return {"status": "mocked", "error": None}

    # ── Build the MIME message ────────────────────────────────────────────────
    msg = MIMEMultipart("alternative")
    msg["From"] = f"AI CRM Brain <{smtp_from}>"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(plain_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    # ── Send with detailed error handling ────────────────────────────────────
    try:
        logger.info(f"📧 Connecting to SMTP server {smtp_server}:{smtp_port} ...")
        with smtplib.SMTP(smtp_server, smtp_port, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_username, smtp_password)
            server.send_message(msg)

        logger.info(f"✅ Invite email sent successfully to {to_email}")
        return {"status": "sent", "error": None}

    except SMTPAuthenticationError as e:
        err = (
            f"SMTP Authentication failed for {smtp_username}. "
            "For Gmail: ensure you are using an App Password, not your regular password. "
            f"Details: {e}"
        )
        logger.exception(f"❌ SMTP Auth Error: {err}")
        return {"status": "failed", "error": err}

    except SMTPConnectError as e:
        err = f"Could not connect to SMTP server {smtp_server}:{smtp_port}. Details: {e}"
        logger.exception(f"❌ SMTP Connect Error: {err}")
        return {"status": "failed", "error": err}

    except SMTPRecipientsRefused as e:
        err = f"Recipient address {to_email} was refused by the SMTP server. Details: {e}"
        logger.exception(f"❌ SMTP Recipient Error: {err}")
        return {"status": "failed", "error": err}

    except socket.timeout:
        err = f"Connection to SMTP server {smtp_server}:{smtp_port} timed out after 10 seconds."
        logger.exception(f"❌ SMTP Timeout: {err}")
        return {"status": "failed", "error": err}

    except Exception as e:
        err = f"Unexpected SMTP error: {type(e).__name__}: {e}"
        logger.exception(f"❌ SMTP Unknown Error: {err}")
        return {"status": "failed", "error": err}
