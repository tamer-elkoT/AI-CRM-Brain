from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Import your routers (the controllers)
from controllers import ingestion_controller, ml_controller, recommendation_controller
from controllers import dashboard_controller, action_controller, auth_controller

app = FastAPI(
    title="AI CRM Brain API",
    description="Backend service for AI-driven sales deal analysis and recommendations",
    version="1.0.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],  # Vite default ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.get("/health")
def health_check():
    """Simple endpoint to verify the service is up."""
    return {"status": "online", "timestamp": "2026-05-25"}


if __name__ == "__main__":
    # Run the server
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
