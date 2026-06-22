from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from sqlalchemy.orm import Session
from models.database import SessionLocal
from models.schema import ZohoDeal, Company, User
from controllers.auth_controller import get_current_user_dep
from models.data_ingestion.zoho_api import fetch_deals_schema, fetch_contacts_by_ids
from sqlalchemy.dialects.postgresql import insert
from typing import Optional
import logging
import os


logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/ingestion/upload")
async def upload_custom_crm(
    file: UploadFile = File(...),
    company_id: Optional[str] = Form(None),
):
    """
    Accepts a .csv or .xlsx file for Custom CRM integration.
    Parses it, inserts rows into ZohoDeal tagged with company_id,
    then triggers the full ML + LLM recommendation pipeline so
    uploaded deals show AI scores immediately on the home page.
    """
    filename = file.filename or ""
    if not (filename.endswith(".csv") or filename.endswith(".xlsx") or filename.endswith(".xls")):
        raise HTTPException(status_code=400, detail="Invalid file type. Only .csv and .xlsx allowed.")

    db: Session = SessionLocal()
    try:
        import pandas as pd
        import uuid
        import io

        contents = await file.read()
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents), engine="openpyxl")

        # Parse company_id if provided
        parsed_company_id = None
        if company_id:
            try:
                import uuid as _uuid
                parsed_company_id = _uuid.UUID(company_id)
            except ValueError:
                logger.warning(f"Invalid company_id format: {company_id}")

        records_processed = 0
        inserted_ids = []
        for _, row in df.iterrows():
            deal_id = f"CUST-{uuid.uuid4().hex[:12].upper()}"
            deal_name = row.get("Deal_Name", "Unknown Deal")
            if pd.isna(deal_name):
                deal_name = "Unknown Deal"

            amount = float(row.get("Amount", 0.0)) if pd.notna(row.get("Amount")) else 0.0
            prob = float(row.get("Probability", 0.0)) if pd.notna(row.get("Probability")) else 0.0

            flattened_record = {
                "id": deal_id,
                "deal_name": str(deal_name),
                "amount": amount,
                "expected_revenue": amount * (prob / 100.0) if prob > 0 else 0.0,
                "zoho_probability": prob,
                "stage": str(row.get("Stage", "Qualification")) if pd.notna(row.get("Stage")) else "Qualification",
                "closing_date": str(row.get("Closing_Date")) if pd.notna(row.get("Closing_Date")) else None,
                "account_name": str(row.get("Account_Name", "Unknown")) if pd.notna(row.get("Account_Name")) else "Unknown",
                "contact_name": str(row.get("Contact_Name", "Unknown")) if pd.notna(row.get("Contact_Name")) else "Unknown",
                "owner_name": str(row.get("Owner_Name", "Unknown")) if pd.notna(row.get("Owner_Name")) else "Unknown",
                "client_phone": str(row.get("Phone")) if pd.notna(row.get("Phone")) else None,
                "client_email": str(row.get("Email")) if pd.notna(row.get("Email")) else None,
                "custom_fields": {},
                "company_id": parsed_company_id,
            }

            stmt = insert(ZohoDeal).values(**flattened_record)
            update_dict = {c.name: c for c in stmt.excluded if c.name != "id"}
            upsert_stmt = stmt.on_conflict_do_update(
                index_elements=["id"], set_=update_dict
            )
            db.execute(upsert_stmt)
            inserted_ids.append(deal_id)
            records_processed += 1

        db.commit()
        logger.info(f"✅ CSV commit complete: {records_processed} rows inserted for IDs: {inserted_ids[:5]}...")

        # ─── Epic 2: Trigger full ML + LLM pipeline for uploaded deals ──────
        # NOTE: The ML/LLM logic lives in recommendation_controller.py (async).
        # We call the underlying engine modules directly (synchronous path) so
        # we can return results in the same HTTP response.
        classify_result = {}
        ml_result = {}
        llm_result = {}

        # ── Phase 1: ML Predictions ─────────────────────────────────────────
        try:
            from models.ml_engine.inference import preprocess_new_deal, predict_batch as _predict_batch
            from sqlalchemy.dialects.postgresql import insert as pg_insert
            from sqlalchemy.sql import func as sqlfunc

            logger.info(f"🤖 Running ML predictions for {len(inserted_ids)} uploaded deals...")
            uploaded_deals = db.query(ZohoDeal).filter(ZohoDeal.id.in_(inserted_ids)).all()

            raw_deals = []
            for d in uploaded_deals:
                raw_deals.append({
                    "Deal_ID": d.id,
                    "Amount": d.amount or 0.0,
                    "Closing_Date": str(d.closing_date) if d.closing_date else "2026-12-31",
                    "Owner_Name": d.owner_name or "Unknown",
                    "Account_Name": d.account_name or "Unknown",
                    "Stage": d.stage or "Qualification",
                })

            from models.schema import MLPrediction
            import uuid as _uuid

            X_processed = preprocess_new_deal(raw_deals)
            predictions = _predict_batch(X_processed)
            batch_id = str(_uuid.uuid4())

            for raw, res in zip(raw_deals, predictions):
                stmt = pg_insert(MLPrediction).values(
                    deal_id=raw["Deal_ID"],
                    predicted_stage_encoded=res["predicted_stage_encoded"],
                    base_probability=res["base_probability"],
                    confidence_all_classes=res["confidence_all_classes"],
                    batch_id=batch_id,
                )
                upsert_stmt = stmt.on_conflict_do_update(
                    index_elements=["deal_id"],
                    set_={
                        "predicted_stage_encoded": stmt.excluded.predicted_stage_encoded,
                        "base_probability": stmt.excluded.base_probability,
                        "confidence_all_classes": stmt.excluded.confidence_all_classes,
                        "batch_id": stmt.excluded.batch_id,
                        "updated_at": sqlfunc.now(),
                    },
                )
                db.execute(upsert_stmt)

            db.commit()
            ml_result = {
                "status": "success",
                "predictions_generated": len(predictions),
                "batch_id": batch_id,
                "sample": predictions[0] if predictions else None,
            }
            logger.info(f"✅ ML Phase complete: {len(predictions)} predictions written.")

        except Exception as ml_err:
            logger.warning(f"⚠️ ML prediction failed for CSV upload (non-fatal): {ml_err}", exc_info=True)

        # ── Phase 2: LLM Recommendations ────────────────────────────────────
        try:
            from models.ml_engine.data_fusion import fuse_deal_payload
            from models.ai_agents.recommender import create_recommender_service
            from models.schema import MLPrediction, LLMRecommendation
            from sqlalchemy.dialects.postgresql import insert as pg_insert
            from sqlalchemy.sql import func as sqlfunc
            import uuid as _uuid

            logger.info(f"🧠 Running LLM recommendations for uploaded deals...")
            llm_service = create_recommender_service()

            predictions_to_process = (
                db.query(MLPrediction)
                .filter(MLPrediction.deal_id.in_(inserted_ids))
                .all()
            )

            rec_count = 0
            llm_batch_id = str(_uuid.uuid4())
            for prediction in predictions_to_process:
                try:
                    fused_payload = fuse_deal_payload(db, prediction)
                    raw_prob = float(fused_payload.get("base_probability", 0))
                    fused_payload["base_probability"] = raw_prob / 100 if raw_prob > 1 else raw_prob

                    recommendation_data = llm_service.generate_recommendation(fused_payload)

                    # Epic 3 Fix: If LLM falls back (e.g. rate limit), it adds extra debugging keys
                    # that don't exist in the LLMRecommendation schema. Pop them to avoid DB crash.
                    recommendation_data.pop("error", None)
                    recommendation_data.pop("is_fallback", None)

                    stmt = pg_insert(LLMRecommendation).values(
                        id=str(_uuid.uuid4()),
                        deal_id=prediction.deal_id,
                        prediction_id=str(prediction.id),
                        batch_id=llm_batch_id,
                        **recommendation_data,
                    )
                    upsert_stmt = stmt.on_conflict_do_update(
                        index_elements=["deal_id", "batch_id"],
                        set_={
                            "adjusted_probability": stmt.excluded.adjusted_probability,
                            "recommendation_ar": stmt.excluded.recommendation_ar,
                            "recommendation_en": stmt.excluded.recommendation_en,
                            "risk_flag": stmt.excluded.risk_flag,
                            "llm_latency_ms": stmt.excluded.llm_latency_ms,
                            "updated_at": sqlfunc.now(),
                        },
                    )
                    db.execute(upsert_stmt)
                    rec_count += 1
                except Exception as single_err:
                    logger.warning(f"⚠️ LLM failed for deal {prediction.deal_id}: {single_err}")
                    continue

            db.commit()
            llm_result = {
                "status": "success",
                "recommendations_generated": rec_count,
                "batch_id": llm_batch_id,
            }
            logger.info(f"✅ LLM Phase complete: {rec_count} recommendations written.")

        except Exception as llm_err:
            logger.warning(f"⚠️ LLM recommendation generation failed for CSV upload (non-fatal): {llm_err}", exc_info=True)

        # ── Phase 3: Deal Classification ─────────────────────────────────────
        try:
            from services.deal_classifier import classify_all_deals
            classify_result = classify_all_deals(db)
            logger.info(f"✅ Classification complete: {classify_result}")
        except Exception as classify_err:
            logger.warning(f"⚠️ Deal classification failed (non-fatal): {classify_err}", exc_info=True)

        return {
            "status": "success",
            "message": f"Successfully processed {records_processed} deals from {filename}.",
            "deals_inserted": records_processed,
            "company_id": str(parsed_company_id) if parsed_company_id else None,
            "ml_predictions": ml_result,
            "llm_recommendations": llm_result,
            "classification": classify_result,
        }

    except Exception as e:
        db.rollback()
        logger.exception(f"Upload processing failed: {e}")
        raise HTTPException(status_code=500, detail=f"Upload processing failed: {str(e)}")
    finally:
        db.close()


@router.post("/ingest/deals")
def ingest_zoho_deals(current_user: User = Depends(get_current_user_dep)):
    """
    Automated Data Pipeline:
    1. Fetches real-time records from Zoho CRM API.
    2. Flattens nested JSON into target DB format, including client_phone / client_email.
    3. Upserts into PostgreSQL — updates ALL columns on conflict so existing rows
       get their phone/email populated even if they were NULL from a prior sync.
    """
    db: Session = SessionLocal()
    try:
        # Epic 1 Multi-Tenant: Get the user's company and its Zoho refresh token.
        # Fall back to the global ZOHO_REFRESH_TOKEN from .env if the company hasn't
        # completed the Zoho OAuth wizard yet (common for admin accounts).
        company = db.query(Company).filter(Company.id == current_user.company_id).first()
        if not company:
            raise HTTPException(status_code=400, detail="User is not associated with a company workspace.")

        refresh_token = (
            company.zoho_refresh_token
            or os.getenv("ZOHO_REFRESH_TOKEN")
        )
        if not refresh_token:
            raise HTTPException(
                status_code=400,
                detail="Zoho is not connected. Please connect Zoho CRM from the wizard or set ZOHO_REFRESH_TOKEN in .env."
            )

        raw_deals = fetch_deals_schema(refresh_token=refresh_token)

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
                contacts_map = fetch_contacts_by_ids(contact_ids, refresh_token=refresh_token)
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
                "company_id": company.id,  # Associate with this workspace
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
