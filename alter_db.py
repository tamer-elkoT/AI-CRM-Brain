from sqlalchemy import text
from models.database import SessionLocal

db = SessionLocal()
try:
    db.execute(text("ALTER TABLE zoho_deals ADD COLUMN IF NOT EXISTS is_escalated BOOLEAN DEFAULT FALSE;"))
    print("Added is_escalated to zoho_deals")
except Exception as e:
    print("Error on zoho_deals:", e)
    
try:
    db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS business_field VARCHAR(255);"))
    print("Added business_field to users")
except Exception as e:
    print("Error on users:", e)

db.commit()
print("Done!")
