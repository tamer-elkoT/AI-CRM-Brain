from fastapi import FastAPI
from controllers import ingestion_controller, ml_controller

app = FastAPI(title="AI CRM Brain API")

# Register Routes (The "Glue")
app.include_router(ingestion_controller.router, prefix="/api/v1", tags=["Ingestion"])
app.include_router(ml_controller.router, prefix="/api/v1", tags=["ML Predictions"])


@app.get("/")
def health_check():
    return {"status": "online"}
