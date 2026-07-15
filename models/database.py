import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Load environment variables from .env file
load_dotenv()

# Build the PostgreSQL Connection URL
DB_USER = os.getenv("POSTGRES_USER")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")

print(f"DEBUG: Connecting as User: {DB_USER} to Database: {DB_NAME}")

if not DB_USER:
    raise ValueError("DB_USER is None! Check your .env file.")

# DB_HOST defaults to "localhost" for local dev.
# Inside Docker Compose, set DB_HOST=db (the service name) and DB_PORT=5432.
DB_HOST = os.getenv("DB_HOST", "localhost")

# Keep only this one!
SQLALCHEMY_DATABASE_URL = (
    f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

# Create the SQLAlchemy Engine
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# Create a SessionLocal class for database sessions
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create the Base class that all our models will inherit from
Base = declarative_base()
