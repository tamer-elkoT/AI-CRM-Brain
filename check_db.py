from models.database import SessionLocal
from models.schema import ZohoDeal, MLPrediction, LLMRecommendation
db = SessionLocal()
print('Deals:', db.query(ZohoDeal).count())
print('Predictions:', db.query(MLPrediction).count())
print('Recs:', db.query(LLMRecommendation).count())
print('Recs with pred:', db.query(LLMRecommendation).filter(LLMRecommendation.prediction_id != None).count())
