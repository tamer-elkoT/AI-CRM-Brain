from models.database import engine, Base
from models.schema import ZohoDeal, MLPrediction, LLMRecommendation

print("Connecting to the database and creating tables...")
Base.metadata.create_all(bind=engine)
print("✅ Tables created successfully!")