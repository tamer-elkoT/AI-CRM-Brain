from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy.orm import Session
from models.database import SessionLocal
from models.schema import ZohoDeal
from models.data_ingestion.zoho_api import fetch_deals_schema, fetch_contacts_by_ids
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

        # ─── Enrich deals with Contact phone/email from Zoho Contacts API ───
        # In Zoho CRM, Phone and Email are Contact-level fields, not Deal-level.
        # Each Deal has Contact_Name: {name, id}. We use the id to fetch real data.
        contact_ids = []
        for deal in raw_deals:
            cn = deal.get("Contact_Name")
            if isinstance(cn, dict) and cn.get("id"):
                contact_ids.append(cn["id"])

        contacts_map = {}
        if contact_ids:
            try:
                contacts_map = fetch_contacts_by_ids(contact_ids)
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Contact enrichment failed (non-fatal): {e}")

        for deal in raw_deals:
            # ------------------------------------------------------------------
            # Extract client_phone/email from the Contact record (not the Deal)
            # ------------------------------------------------------------------
            contact_id = None
            cn = deal.get("Contact_Name")
            if isinstance(cn, dict):
                contact_id = cn.get("id")

            contact_info = contacts_map.get(contact_id, {}) if contact_id else {}
            client_phone = contact_info.get("phone") or None
            client_email = contact_info.get("email") or None

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
                "custom_fields": deal.get("Custom_Fields") if deal.get("Custom_Fields") is not None else {},
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

        # Sprint 5: Classify all deals after sync
        classify_result = {}
        try:
            from services.deal_classifier import classify_all_deals
            classify_result = classify_all_deals(db)
        except Exception as classify_err:
            import logging
            logging.getLogger(__name__).warning(f"Deal classification after sync failed (non-fatal): {classify_err}")

        return {
            "status": "success",
            "message": f"Pipeline successfully automated. Synced {records_processed} deals to PostgreSQL.",
            "source": "Zoho CRM REST API v3",
            "classification": classify_result,
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Pipeline execution failed: {str(e)}")

    finally:
        db.close()
