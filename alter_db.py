"""
alter_db.py — Run this ONCE to ensure client_phone / client_email columns
exist on the zoho_deals table. Safe to run multiple times (IF NOT EXISTS).

Usage:
    python alter_db.py
"""
from sqlalchemy import text
from models.database import engine

SQL = text("""
ALTER TABLE zoho_deals
    ADD COLUMN IF NOT EXISTS client_phone VARCHAR(255),
    ADD COLUMN IF NOT EXISTS client_email VARCHAR(255);
""")

def run():
    with engine.connect() as conn:
        conn.execute(SQL)
        conn.commit()
        print("✅  Columns client_phone / client_email ensured on zoho_deals.")

if __name__ == "__main__":
    run()