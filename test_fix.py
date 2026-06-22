import sys
sys.path.insert(0, '.')
from controllers.recommendation_controller import notify_sales_manager
print("Import OK")
notify_sales_manager("Test Deal", "Test Account", 50000, "Test AI", "HIGH_RISK")
print("Function call OK")
