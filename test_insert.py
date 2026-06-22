import asyncio
from models.database import SessionLocal
from controllers.recommendation_controller import llm_service
from models.ml_engine.data_fusion import fuse_deal_payload
from models.schema import MLPrediction, LLMRecommendation
import uuid
from sqlalchemy.dialects.postgresql import insert
import datetime

def test_generation_and_insert():
    db = SessionLocal()
    try:
        prediction = db.query(MLPrediction).first()
        fused_payload = fuse_deal_payload(db, prediction)
        raw_prob = float(fused_payload.get("base_probability", 0))
        fused_payload["base_probability"] = raw_prob / 100 if raw_prob > 1 else raw_prob
        
        print("Testing generation...")
        recommendation_data = llm_service.generate_recommendation(fused_payload)
        print("Populating keys...")
        recommendation_data.pop("error", None)
        recommendation_data.pop("is_fallback", None)
        
        print("Inserting...")
        stmt = insert(LLMRecommendation).values(
            id=str(uuid.uuid4()),
            deal_id=prediction.deal_id,
            prediction_id=str(prediction.id),
            batch_id=str(uuid.uuid4()),
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
                "updated_at": datetime.datetime.utcnow(),
            },
        )
        db.execute(upsert_stmt)
        db.commit()
        print("✅ INSERT SUCCESS!")
        
    except Exception as e:
        print("❌ INSERT EXCEPTION:", e)
    finally:
        db.close()

if __name__ == "__main__":
    test_generation_and_insert()
