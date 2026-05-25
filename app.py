from fastapi import FastAPI
import uvicorn

# Import your routers (the controllers)
from controllers import ingestion_controller, ml_controller, recommendation_controller

app = FastAPI(
    title="AI CRM Brain API",
    description="Backend service for AI-driven sales deal analysis and recommendations",
    version="1.0.0",
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


@app.get("/health")
def health_check():
    """Simple endpoint to verify the service is up."""
    return {"status": "online", "timestamp": "2026-05-25"}


if __name__ == "__main__":
    # Run the server
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
