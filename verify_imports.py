import sys
sys.path.insert(0, '.')
from controllers.followup_controller import _schedule_all_followups
print("_schedule_all_followups: OK")
from controllers.recommendation_controller import generate_all_recommendations
print("generate_all_recommendations: OK")
print("All imports OK - uvicorn will pick up changes on next reload")
