from models.database import SessionLocal
from models.schema import LLMRecommendation

def cleanup():
    db = SessionLocal()
    try:
        # Find all fallback recommendations
        fallbacks = db.query(LLMRecommendation).filter(
            LLMRecommendation.recommendation_en.like('%failed (system error)%')
        ).all()
        
        count = len(fallbacks)
        for f in fallbacks:
            db.delete(f)
            
        db.commit()
        print(f"✅ Successfully deleted {count} fallback recommendations!")
    finally:
        db.close()

if __name__ == "__main__":
    cleanup()
