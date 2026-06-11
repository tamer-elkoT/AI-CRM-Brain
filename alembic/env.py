"""
Alembic environment configuration for AI CRM Brain.
Reads the DB connection string from the project's config module
and registers all SQLAlchemy models for autogenerate support.
"""

from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import os
import sys

# ── Make the project root importable ─────────────────────────────────────────
# alembic/ sits one level below the project root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ── Load project config & models ──────────────────────────────────────────────
from config import settings          # reads .env
from models.database import Base     # declarative base
# Import ALL models so Alembic can detect their tables
import models.schema  # noqa: F401 — registers User, ZohoDeal, MLPrediction, etc.

# ── Alembic Config object ─────────────────────────────────────────────────────
config = context.config

# ── Build connection string ───────────────────────────────────────────────────
# DB always runs on localhost via Docker (port 5433 → internal 5432)
DATABASE_URL = (
    f"postgresql://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}"
    f"@localhost:{settings.DB_PORT}/{settings.DB_NAME}"
)
config.set_main_option("sqlalchemy.url", DATABASE_URL)

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# This is the MetaData object for autogenerate support
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode (no live DB connection required).
    Generates raw SQL that you can review before applying.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode (connects to the live DB).
    This is what `alembic upgrade head` uses.
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
