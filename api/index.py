# ─────────────────────────────────────────────────────────────
# api/index.py — Vercel Serverless Entry Point
#
# Vercel's @vercel/python runtime looks for a `handler` variable
# in api/index.py. Mangum adapts the FastAPI ASGI app to the
# AWS Lambda / Vercel Function (ASGI-over-HTTP) interface.
# ─────────────────────────────────────────────────────────────
import sys
import os

# Ensure the project root is on the path so all imports work
# (api/ is a subdirectory; root modules like app.py, controllers/, etc. are one level up)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mangum import Mangum
from app import app  # FastAPI application instance from root app.py

# lifespan="off" disables startup/shutdown events (APScheduler) since
# Vercel serverless functions are stateless and ephemeral.
handler = Mangum(app, lifespan="off")
