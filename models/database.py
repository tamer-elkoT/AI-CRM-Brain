import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Load environment variables from .env file
load_dotenv()

# ─────────────────────────────────────────────────────────────
# Database URL Resolution
#
# Priority 1 (Cloud / Production):
#   Set DATABASE_URL to a full connection string, e.g.:
#   postgresql://user:pass@host/dbname?sslmode=require
#
# Priority 2 (Local / Docker Compose):
#   Set individual variables: POSTGRES_USER, POSTGRES_PASSWORD,
#   DB_HOST, DB_PORT, DB_NAME. SSL is not required for local dev.
# ─────────────────────────────────────────────────────────────

DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    # Cloud mode (Neon, Supabase, RDS, etc.)
    # Neon requires ?sslmode=require — preserve it as-is if present.
    SQLALCHEMY_DATABASE_URL = DATABASE_URL
    print(f"DEBUG: Connecting via DATABASE_URL (cloud mode)")
else:
    # Local / Docker Compose mode — build URL from individual vars
    DB_USER = os.getenv("POSTGRES_USER")
    DB_PASSWORD = os.getenv("POSTGRES_PASSWORD")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_NAME = os.getenv("DB_NAME")
    DB_HOST = os.getenv("DB_HOST", "localhost")

    if not DB_USER:
        raise ValueError(
            "Database not configured. Set DATABASE_URL (cloud) "
            "or POSTGRES_USER / POSTGRES_PASSWORD / DB_NAME (local)."
        )

    SQLALCHEMY_DATABASE_URL = (
        f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )
    print(f"DEBUG: Connecting as User: {DB_USER} to Database: {DB_NAME} on {DB_HOST}:{DB_PORT}")

# ─────────────────────────────────────────────────────────────
# SQLAlchemy Engine
#
# connect_args: pass sslmode for cloud providers that require it.
# pool_pre_ping: detects stale connections (important for Neon's
#   serverless model which may idle-disconnect).
# pool_size / max_overflow: keep small for Neon's connection limits.
# ─────────────────────────────────────────────────────────────
connect_args = {}
if DATABASE_URL and "sslmode=require" in DATABASE_URL:
    connect_args["sslmode"] = "require"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,      # verify connection health before using
    pool_size=5,             # Neon free tier has a connection limit
    max_overflow=10,
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for all ORM models
Base = declarative_base()
