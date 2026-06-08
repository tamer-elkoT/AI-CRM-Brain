# test_llm_integration.py
import os
from dotenv import load_dotenv
from models.ai_agents.recommender import create_recommender_service

# 1. Load your .env (where GROQ_API_KEY lives)
load_dotenv()

def test_prompt_generation():
    print("🚀 Initializing Recommender Service...")
    service = create_recommender_service()
    
    # 2. Simulate a deal that has already been processed by your ML model
    # This structure matches what your recommender.py expects
    test_deal = {
        "deal_id": "TEST_DEAL_001",
        "deal_name": "Mega Corp Software License",
        "base_probability": 0.65,
        "stage": "Proposal/Price",
        "amount": 55000,
        "days_to_close": 12,
        "account_name": "Mega Corp",
        "owner_name": "Sara Mohamed",
        "custom_fields": {
            "Competitor_Present": "CompetitorX mentioned",
            "Budget_Approved": "Under Review",
            "Decision_Maker_Engaged": "No"
        }
    }

    print(f"🔍 Testing LLM with deal: {test_deal['deal_name']}...")
    
    # 3. Call your service
    try:
        recommendation = service.generate_recommendation(test_deal)
        
        print("\n✅ LLM Output Received Successfully:")
        print("-" * 30)
        print(f"Adjusted Prob: {recommendation['adjusted_probability']}")
        print(f"Risk Flag:     {recommendation['risk_flag']}")
        print(f"Arabic Rec:    {recommendation['recommendation_ar']}")
        print("-" * 30)
        
    except Exception as e:
        print(f"\n❌ Test Failed: {e}")

if __name__ == "__main__":
    test_prompt_generation()