import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.database import SessionLocal
from models.schema import ZohoDeal, DealFollowup, Notification

def reset_all():
    db = SessionLocal()
    try:
        # Reset action statuses
        db.query(ZohoDeal).update({"action_status": "no_action"})
        
        # Clear out existing followups and notifications so we get a clean slate
        db.query(DealFollowup).delete()
        db.query(Notification).delete()
        
        db.commit()
        print("✅ Reset complete! All deals are back to 'no_action'.")
        print("Now click 'Sync & Refresh' in the UI to trigger notifications and WhatsApp alerts.")
    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    reset_all()
