import sys
sys.path.insert(0, '.')
from models.database import SessionLocal
from models.schema import User, DealFollowup, ZohoDeal, LLMRecommendation
from datetime import datetime, timezone

db = SessionLocal()

print("=== USERS WITH PHONES ===")
users = db.query(User).all()
for u in users:
    print(f"  {u.name} | {u.email} | phone={u.phone_number} | role={u.role}")

print("\n=== DUE DEFERRED FOLLOWUPS ===")
now = datetime.now(timezone.utc)
due = (
    db.query(DealFollowup, ZohoDeal)
    .join(ZohoDeal, DealFollowup.deal_id == ZohoDeal.id)
    .filter(
        DealFollowup.notified_at.is_(None),
        DealFollowup.scheduled_at <= now,
        DealFollowup.urgency == "deferred",
    ).all()
)
print(f"  Found: {len(due)} due followups")
for f, d in due[:5]:
    print(f"  Deal: {d.deal_name} | Owner: {d.owner_name} | Due: {f.scheduled_at}")

print("\n=== ALL FOLLOWUPS (last 5) ===")
all_fups = db.query(DealFollowup, ZohoDeal).join(ZohoDeal, DealFollowup.deal_id == ZohoDeal.id).order_by(DealFollowup.created_at.desc()).limit(5).all()
for f, d in all_fups:
    print(f"  Deal: {d.deal_name} | urgency={f.urgency} | scheduled={f.scheduled_at} | notified={f.notified_at}")

db.close()
