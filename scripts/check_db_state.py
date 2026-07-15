from models.database import SessionLocal
from models.schema import ZohoDeal, MLPrediction, LLMRecommendation

def check_db():
    db = SessionLocal()
    try:
        deals = db.query(ZohoDeal).all()
        print(f"Total Deals: {len(deals)}")
        
        preds = db.query(MLPrediction).all()
        print(f"Total ML Predictions: {len(preds)}")
        
        recs = db.query(LLMRecommendation).all()
        print(f"Total LLM Recommendations: {len(recs)}")
        
        deals_needing_recs = db.query(MLPrediction).outerjoin(
            LLMRecommendation, MLPrediction.deal_id == LLMRecommendation.deal_id
        ).filter(LLMRecommendation.id == None).all()
        print(f"ML Predictions needing LLM Recs: {len(deals_needing_recs)}")
        
    finally:
        db.close()

if __name__ == "__main__":
    check_db()
