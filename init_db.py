import os
from models.database import engine, Base
# Import all models so they are registered with Base.metadata
from models.schema import *

print("Building database tables...")
try:
    Base.metadata.create_all(bind=engine)
    print("✅ All base tables created successfully!")
except Exception as e:
    print(f"❌ Error creating tables: {e}")
