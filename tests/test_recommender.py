"""
Unit tests for LLM recommendation service.
"""

import pytest
from unittest.mock import Mock, patch
from models.ai_agents.recommender import LLMRecommenderService


@pytest.fixture
def mock_llm_service():
    return LLMRecommenderService(
        api_key="test-key",
        model_id="gpt-4-test"
    )


def test_parse_valid_json(mock_llm_service):
    """Test parsing of valid LLM JSON response."""
    raw = '''
    {
        "adjusted_probability": 0.85,
        "recommendation_ar": "توصية اختبار",
        "recommendation_en": "Test recommendation",
        "risk_flag": "NONE"
    }
    '''
    
    result = mock_llm_service._parse_and_validate(raw)
    assert result.adjusted_probability == 0.85
    assert "اختبار" in result.recommendation_ar


def test_fallback_on_llm_failure(mock_llm_service):
    """Test fallback response when LLM API fails."""
    deal_data = {
        "deal_id": "123",
        "base_probability": 0.75
    }
    
    with patch.object(mock_llm_service, '_call_llm_api', side_effect=Exception("API Error")):
        result = mock_llm_service.generate_recommendation(deal_data)
        
        assert result["is_fallback"] is True
        assert result["adjusted_probability"] == 0.75
        assert "error" in result


@pytest.mark.integration
def test_end_to_end_recommendation(db_session):
    """Integration test: ML prediction → LLM → database."""
    # This would require a test database and mock LLM responses
    pass