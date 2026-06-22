"""
Clean up duplicate CRM accounts:
- Keep only the ACTIVE account for each person (the one with a connected WhatsApp or last login)
- Delete ghost accounts that were created during testing
Run: python cleanup_duplicate_users.py
"""
import sys
sys.path.insert(0, '.')
from models.database import SessionLocal
from models.schema import User

db = SessionLocal()

print("Current users:")
for u in db.query(User).order_by(User.name, User.created_at).all():
    print(f"  [{u.id}] {u.name!r} | {u.email} | {u.role} | {u.phone_number}")

print()
print("To DELETE a ghost account, uncomment the relevant line below and re-run.")
print("Keep the account whose email you actually log in with.")
print()

# ── Tamer Elkot: keep tamerelkot@gmail.com (eb6e...) and tamer.elkot.ai1@gmail.com (63a8...)
# Delete this one if you only want ONE Tamer account:
# user_to_delete = db.query(User).filter(User.id == 'a7164723-3d18-42f3-973e-f6cb7fd41e1f').first()
# if user_to_delete:
#     db.delete(user_to_delete)
#     db.commit()
#     print(f"Deleted: {user_to_delete.email}")

print("Edit this script to uncomment the account(s) you want to delete, then re-run.")
db.close()
