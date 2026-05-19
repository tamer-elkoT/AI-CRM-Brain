import os
from dotenv import load_dotenv
from sqlalchemy import create_engine

# IMPORTANT: Import all your models here so Base knows about them
from models.schema import Base, ZohoDeal, MLPrediction, LLMRecommendation

load_dotenv()

# Use the same URL confirmed by your test_db.py script
DATABASE_URL = f"postgresql://{os.getenv('POSTGRES_USER')}:{os.getenv('POSTGRES_PASSWORD')}@localhost:5433/{os.getenv('DB_NAME')}"

engine = create_engine(DATABASE_URL)


def init_db():
    print("🚀 Creating tables...")
    Base.metadata.create_all(engine)
    print("✅ Tables created successfully.")


if __name__ == "__main__":
    init_db()
