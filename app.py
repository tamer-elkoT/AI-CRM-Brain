from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Import your routers (the controllers)
from controllers import ingestion_controller, ml_controller, recommendation_controller
from controllers import dashboard_controller, action_controller, auth_controller
from controllers import followup_controller, notification_controller, team_controller
# Epic 2: analytics endpoint
from controllers import analytics_controller

app = FastAPI(
    title="AI CRM Brain API",
    description="Backend service for AI-driven sales deal analysis and recommendations",
    version="1.0.0",
)

# Add CORS middleware — use regex to match any localhost port (avoids 400 on OPTIONS preflight)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Register Routes (The "Glue")
# Ingestion: Fetching data from Zoho
app.include_router(ingestion_controller.router, prefix="/api/v1", tags=["Ingestion"])

# ML Predictions: Running the Random Forest model
app.include_router(ml_controller.router, prefix="/api/v1", tags=["ML Predictions"])

# Recommendation Engine: The LLM integration
app.include_router(
    recommendation_controller.router, prefix="/api/v1", tags=["LLM Recommendations"]
)

# UI & Actions
app.include_router(dashboard_controller.router, prefix="/api/v1", tags=["Dashboard"])
app.include_router(action_controller.router, prefix="/api/v1", tags=["Actions"])
app.include_router(auth_controller.router, prefix="/api/v1/auth", tags=["Auth"])

# Sprint 5: Follow-up & Notifications
app.include_router(followup_controller.router, prefix="/api/v1", tags=["Follow-ups"])
app.include_router(notification_controller.router, prefix="/api/v1", tags=["Notifications"])

# Epic 2: Analytics
app.include_router(analytics_controller.router, prefix="/api/v1", tags=["Analytics"])

# Team management
app.include_router(team_controller.router, prefix="/api/v1", tags=["Team"])


@app.get("/health")
def health_check():
    """Simple endpoint to verify the service is up."""
    return {"status": "online", "timestamp": "2026-06-05"}


# Sprint 5: Start background follow-up scheduler
@app.on_event("startup")
def start_followup_scheduler():
    """Start the APScheduler to check deferred follow-ups every 60 minutes."""
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from services.followup_scheduler import check_deferred_followups

        scheduler = BackgroundScheduler()
        scheduler.add_job(
            check_deferred_followups,
            "interval",
            minutes=60,
            id="followup_checker",
            replace_existing=True,
        )
        scheduler.start()
        import logging
        logging.getLogger(__name__).info("✅ Follow-up scheduler started (every 60 min)")
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"⚠️ Could not start follow-up scheduler: {e}")


if __name__ == "__main__":
    # Run the server explicitly watching backend directories
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True, reload_dirs=["controllers", "models", "services", "utils", "."])
