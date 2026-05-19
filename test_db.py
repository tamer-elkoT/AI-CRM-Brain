from sqlalchemy import create_engine, MetaData, Table, Column, String
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = f"postgresql://{os.getenv('POSTGRES_USER')}:{os.getenv('POSTGRES_PASSWORD')}@localhost:5433/{os.getenv('DB_NAME')}"

try:
    engine = create_engine(DATABASE_URL)
    metadata = MetaData()

    # Define a simple table
    test_table = Table(
        "test_connection", metadata, Column("id", String, primary_key=True)
    )

    metadata.create_all(engine)
    print("✅ Success! Connected to database and created 'test_connection' table.")
except Exception as e:
    print(f"❌ Connection failed: {e}")
