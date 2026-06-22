import asyncio
from models.database import SessionLocal
from controllers.recommendation_controller import llm_service
from models.ml_engine.data_fusion import fuse_deal_payload
from models.schema import MLPrediction

def test_generation():
    db = SessionLocal()
    try:
        prediction = db.query(MLPrediction).first()
        if not prediction:
            print("No prediction found")
            return
            
        fused_payload = fuse_deal_payload(db, prediction)
        raw_prob = float(fused_payload.get("base_probability", 0))
        fused_payload["base_probability"] = raw_prob / 100 if raw_prob > 1 else raw_prob
        
        print("Testing generation...")
        res = llm_service.generate_recommendation(fused_payload)
        print("Result:", res)
        
    except Exception as e:
        print("Exception:", e)
    finally:
        db.close()

if __name__ == "__main__":
    test_generation()
