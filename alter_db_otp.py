"""
alter_db_otp.py — Run this ONCE to ensure the otp_codes table and
new user columns (role, phone_number, etc.) exist.
Safe to run multiple times (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

Usage:
    python alter_db_otp.py
"""
from sqlalchemy import text
from models.database import engine

USERS_COLUMNS = text("""
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role             VARCHAR(20)  DEFAULT 'Sales',
    ADD COLUMN IF NOT EXISTS phone_number     VARCHAR(30),
    ADD COLUMN IF NOT EXISTS is_whatsapp_verified BOOLEAN  DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS whatsapp_template TEXT,
    ADD COLUMN IF NOT EXISTS email_template    TEXT;
""")

OTP_TABLE = text("""
CREATE TABLE IF NOT EXISTS otp_codes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone_number    VARCHAR(30)  NOT NULL,
    otp_code        VARCHAR(6)   NOT NULL,
    expires_at      TIMESTAMPTZ  NOT NULL,
    created_at      TIMESTAMPTZ  DEFAULT NOW()
);
""")


def run():
    with engine.connect() as conn:
        conn.execute(USERS_COLUMNS)
        conn.execute(OTP_TABLE)
        conn.commit()
        print("✅  otp_codes table created & user columns ensured.")


if __name__ == "__main__":
    run()
