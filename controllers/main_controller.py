import logging
from sqlalchemy.orm import Session
from models.schemas import ZohoDeal, MLPrediction, LLMRecommendation
from models.ai_agents.recommender import create_recommender_service

logger = logging.getLogger(__name__)


def generate_recommendations_for_deal(db: Session, deal_id: str):
    """
    Orchestrates the full flow:
    1. Fetch deal & ML prediction
    2. Fuse data
    3. Generate LLM recommendation
    4. Save to DB
    """

    # 1. Fetch data from DB
    deal = db.query(ZohoDeal).filter(ZohoDeal.id == deal_id).first()
    prediction = db.query(MLPrediction).filter(MLPrediction.deal_id == deal_id).first()

    if not deal or not prediction:
        raise ValueError(f"Deal or ML Prediction not found for ID: {deal_id}")

    # 2. Data Fusion (Prepare payload for LLM)
    deal_payload = {
        "deal_id": deal.id,
        "deal_name": deal.deal_name,
        "base_probability": prediction.base_probability,
        "stage": deal.stage,
        "amount": deal.amount,
        "account_name": deal.account_name,
        "owner_name": deal.owner_name,
        "custom_fields": deal.custom_fields,
        # Feature vector helps the LLM understand the "why" behind the score
        "feature_vector": prediction.feature_vector,
    }

    # 3. Call LLM Service
    service = create_recommender_service()
    recommendation_data = service.generate_recommendation(deal_payload)

    # 4. Save to DB
    new_rec = LLMRecommendation(
        deal_id=deal_id,
        prediction_id=prediction.id,
        llm_payload=deal_payload,
        adjusted_probability=recommendation_data["adjusted_probability"],
        base_probability=prediction.base_probability,
        recommendation_ar=recommendation_data["recommendation_ar"],
        recommendation_en=recommendation_data.get("recommendation_en"),
        risk_flag=recommendation_data["risk_flag"],
        risk_reasoning=recommendation_data["risk_reasoning"],
        llm_model_id=recommendation_data["llm_model_id"],
        prompt_version=recommendation_data["prompt_version"],
        llm_latency_ms=recommendation_data["llm_latency_ms"],
        llm_tokens_used=recommendation_data["llm_tokens_used"],
    )

    db.add(new_rec)
    db.commit()
    return new_rec
