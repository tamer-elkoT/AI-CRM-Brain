import sys
sys.path.insert(0, '.')
import logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')

from services.followup_scheduler import check_deferred_followups

print("Running follow-up scheduler manually...")
check_deferred_followups()
print("Done.")
