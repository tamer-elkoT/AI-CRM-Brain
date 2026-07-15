import sys
sys.path.insert(0, '.')
from controllers import team_controller
print("team_controller OK")
from controllers import followup_controller
print("followup_controller OK — trigger-scheduler endpoint added")
from app import app
routes = [r.path for r in app.routes]
print("Routes with /team:", [r for r in routes if 'team' in r])
print("Routes with trigger:", [r for r in routes if 'trigger' in r])
