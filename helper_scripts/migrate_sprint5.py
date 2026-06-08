"""
Sprint 5 Migration Script
Creates new tables and adds new columns for Features 1-9.
Safe to run multiple times (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
"""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

DATABASE_URL = f"postgresql://{os.getenv('POSTGRES_USER')}:{os.getenv('POSTGRES_PASSWORD')}@localhost:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"

engine = create_engine(DATABASE_URL)

MIGRATION_SQL = """
-- ============================================================
-- Sprint 5: New columns on zoho_deals
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'zoho_deals' AND column_name = 'action_status'
    ) THEN
        ALTER TABLE zoho_deals ADD COLUMN action_status VARCHAR(30) DEFAULT 'no_action';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'zoho_deals' AND column_name = 'followup_days_override'
    ) THEN
        ALTER TABLE zoho_deals ADD COLUMN followup_days_override INTEGER DEFAULT 3;
    END IF;
END
$$;

-- ============================================================
-- Sprint 5: deal_followups table
-- ============================================================
CREATE TABLE IF NOT EXISTS deal_followups (
    id SERIAL PRIMARY KEY,
    deal_id VARCHAR NOT NULL REFERENCES zoho_deals(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    urgency VARCHAR(20) NOT NULL,
    followup_days INTEGER DEFAULT 3,
    notified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Sprint 5: followup_logs table
-- ============================================================
CREATE TABLE IF NOT EXISTS followup_logs (
    id SERIAL PRIMARY KEY,
    deal_id VARCHAR NOT NULL REFERENCES zoho_deals(id) ON DELETE CASCADE,
    sales_rep_id UUID REFERENCES users(id),
    followed_up_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    channel VARCHAR(30) DEFAULT 'whatsapp',
    message_sent TEXT,
    notes TEXT
);

-- ============================================================
-- Sprint 5: notifications table
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deal_id VARCHAR,
    type VARCHAR(30) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast notification queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notifications(user_id, is_read) WHERE is_read = FALSE;

CREATE INDEX IF NOT EXISTS idx_deal_followups_pending
    ON deal_followups(scheduled_at, notified_at) WHERE notified_at IS NULL;
"""


def run_migration():
    print("🚀 Running Sprint 5 migration...")
    with engine.begin() as conn:
        conn.execute(text(MIGRATION_SQL))
    print("✅ Sprint 5 migration complete!")
    print("   - Added action_status, followup_days_override columns to zoho_deals")
    print("   - Created deal_followups table")
    print("   - Created followup_logs table")
    print("   - Created notifications table")
    print("   - Created performance indexes")


if __name__ == "__main__":
    run_migration()
