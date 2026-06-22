import sys
sys.path.insert(0, '.')
from models.database import SessionLocal
from models.schema import DealFollowup
from sqlalchemy import text

db = SessionLocal()

# Keep only the latest follow-up per deal, delete duplicates
result = db.execute(text("""
    DELETE FROM deal_followups
    WHERE id NOT IN (
        SELECT DISTINCT ON (deal_id) id
        FROM deal_followups
        ORDER BY deal_id, created_at DESC
    )
"""))
db.commit()
print(f"Cleaned up {result.rowcount} duplicate follow-up records")

# Reset notified_at on remaining ones so next run works cleanly
db.execute(text("UPDATE deal_followups SET notified_at = NULL"))
db.commit()

remaining = db.query(DealFollowup).count()
print(f"Remaining follow-ups: {remaining} (all reset for next scheduler run)")
db.close()
