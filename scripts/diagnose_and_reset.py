"""
Diagnostic: Check the manager's user record, phone, deal ownership, and reset
notified_at so the scheduler will re-send to them.
"""
import sys
sys.path.insert(0, '.')
import logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')

from models.database import SessionLocal
from models.schema import User, ZohoDeal, DealFollowup

db = SessionLocal()

print("=" * 60)
print("ALL USERS")
print("=" * 60)
for u in db.query(User).all():
    print(f"  ID:    {u.id}")
    print(f"  Name:  {u.name!r}")
    print(f"  Email: {u.email}")
    print(f"  Role:  {u.role}")
    print(f"  Phone: {u.phone_number}")
    print()

print("=" * 60)
print("ALL DEALS (owner_name)")
print("=" * 60)
for d in db.query(ZohoDeal).all():
    print(f"  Deal: {d.deal_name!r}  →  owner: {d.owner_name!r}")

print()
print("=" * 60)
print("ALL FOLLOW-UPS")
print("=" * 60)
for f in db.query(DealFollowup).all():
    deal = db.query(ZohoDeal).filter(ZohoDeal.id == f.deal_id).first()
    print(f"  Deal: {deal.deal_name if deal else f.deal_id!r}")
    print(f"  urgency={f.urgency}  notified_at={f.notified_at}")

print()
print("Resetting notified_at for all follow-ups so scheduler can re-send...")
for f in db.query(DealFollowup).all():
    f.notified_at = None
db.commit()
print("✅ Done — all follow-ups reset. Run trigger_scheduler.py to test.")

db.close()
