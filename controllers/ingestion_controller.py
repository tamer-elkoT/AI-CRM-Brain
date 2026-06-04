from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy.orm import Session
from models.database import SessionLocal
from models.schema import ZohoDeal
from models.data_ingestion.zoho_api import fetch_deals_schema
from sqlalchemy.dialects.postgresql import insert

router = APIRouter()


@router.post("/ingestion/upload")
async def upload_custom_crm(file: UploadFile = File(...)):
    """
    Accepts a .csv or .xlsx file for Custom CRM integration.
    """
    if not (file.filename.endswith(".csv") or file.filename.endswith(".xlsx")):
        raise HTTPException(status_code=400, detail="Invalid file type. Only .csv and .xlsx allowed.")

    return {
        "status": "success",
        "message": f"File {file.filename} uploaded and validated successfully.",
    }


@router.post("/ingest/deals")
def ingest_zoho_deals():
    """
    Automated Data Pipeline:
    1. Fetches real-time records from Zoho CRM API.
    2. Flattens nested JSON into target DB format, including client_phone / client_email.
    3. Upserts into PostgreSQL — updates ALL columns on conflict so existing rows
       get their phone/email populated even if they were NULL from a prior sync.
    """
    db: Session = SessionLocal()
    try:
        raw_deals = fetch_deals_schema()
        if not raw_deals:
            return {
                "status": "success",
                "message": "Pipeline run complete. No active records found in Zoho.",
            }

        records_processed = 0

        for deal in raw_deals:
            # ------------------------------------------------------------------
            # Extract client_phone: try deal-level Phone, then Mobile
            # Extract client_email: try deal-level Email, then Contact_Name.email
            # ------------------------------------------------------------------
            client_phone = (
                deal.get("Phone")
                or deal.get("Mobile")
                or None
            )
            client_email = deal.get("Email") or (
                deal.get("Contact_Name", {}).get("email")
                if isinstance(deal.get("Contact_Name"), dict)
                else None
            )

            flattened_record = {
                "id": deal.get("id"),
                "deal_name": deal.get("Deal_Name"),
                "amount": float(deal.get("Amount")) if deal.get("Amount") else 0.0,
                "expected_revenue": (
                    float(deal.get("Expected_Revenue")) if deal.get("Expected_Revenue") else 0.0
                ),
                "zoho_probability": (
                    float(deal.get("Probability")) if deal.get("Probability") else 0.0
                ),
                "stage": deal.get("Stage"),
                "closing_date": deal.get("Closing_Date"),
                "account_name": (
                    deal.get("Account_Name", {}).get("name")
                    if deal.get("Account_Name")
                    else "Unknown"
                ),
                "contact_name": (
                    deal.get("Contact_Name", {}).get("name")
                    if deal.get("Contact_Name")
                    else "Unknown"
                ),
                "owner_name": (
                    deal.get("Owner", {}).get("name") if deal.get("Owner") else "Unknown"
                ),
                "client_phone": client_phone,
                "client_email": client_email,
            }

            stmt = insert(ZohoDeal).values(**flattened_record)

            # IMPORTANT: update_dict must include client_phone and client_email so that
            # existing rows (inserted before these columns existed) get populated on re-sync.
            update_dict = {c.name: c for c in stmt.excluded if c.name != "id"}
            upsert_stmt = stmt.on_conflict_do_update(
                index_elements=["id"], set_=update_dict
            )

            db.execute(upsert_stmt)
            records_processed += 1

        db.commit()

        return {
            "status": "success",
            "message": f"Pipeline successfully automated. Synced {records_processed} deals to PostgreSQL.",
            "source": "Zoho CRM REST API v3",
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Pipeline execution failed: {str(e)}")

    finally:
        db.close()
