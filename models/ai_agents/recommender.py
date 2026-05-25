"""
LLM-powered recommendation service for sales deal analysis.
"""

import httpx
import json
import time
import logging
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field, validator

# CHANGE: Import client and errors specifically
from openai import OpenAI, RateLimitError, APIError
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from models.ai_agents.prompts import build_llm_prompt, PROMPT_VERSION
from config import settings  # Your config module

logger = logging.getLogger(__name__)


# --- Response Validation Schema ---
class LLMRecommendationOutput(BaseModel):
    """Pydantic model for validating LLM JSON responses."""

    adjusted_probability: float = Field(..., ge=0.0, le=1.0)
    recommendation_ar: str = Field(..., min_length=10, max_length=1000)
    recommendation_en: Optional[str] = Field(None, max_length=1000)
    risk_flag: Optional[str] = Field("NONE")
    risk_reasoning: Optional[str] = Field(None, max_length=500)

    @validator("risk_flag")
    def validate_risk_flag(cls, v):
        allowed = [
            "HIGH_RISK",
            "COMPETITOR_PRESENT",
            "STALLED",
            "BUDGET_UNCERTAIN",
            "NONE",
        ]
        if v not in allowed:
            return "NONE"
        return v


# --- Main Recommender Service ---
class LLMRecommenderService:
    def __init__(
        self,
        api_key: str,
        base_url: str,
        model_id: str = "llama-3.3-70b-versatile",
        max_tokens: int = 500,
        temperature: float = 0.3,
    ):
        self.api_key = api_key
        self.base_url = base_url
        self.model_id = model_id
        self.max_tokens = max_tokens
        self.temperature = temperature

        # This prevents the "unexpected keyword argument 'proxies'" error
        http_client = httpx.Client(proxies=None)

        # 3. Initialize the OpenAI client with the custom http_client
        self.client = OpenAI(
            api_key=self.api_key, base_url=self.base_url, http_client=http_client
        )

        logger.info(f"LLM Recommender initialized with model: {model_id}")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        # Use the imported error classes here
        retry=retry_if_exception_type((RateLimitError, APIError)),
    )
    def _call_llm_api(self, messages: list) -> Dict[str, Any]:
        start_time = time.time()

        try:
            # Use the new client format
            response = self.client.chat.completions.create(
                model=self.model_id,
                messages=messages,
                max_tokens=self.max_tokens,
                temperature=self.temperature,
                # Groq/OpenAI compatible response format
                response_format={"type": "json_object"},
            )

            latency_ms = int((time.time() - start_time) * 1000)

            return {
                "content": response.choices[0].message.content,
                "latency_ms": latency_ms,
                "tokens_used": response.usage.total_tokens,
            }

        except Exception as e:
            logger.error(f"LLM API call failed: {str(e)}")
            raise

    def _parse_and_validate(self, raw_content: str) -> LLMRecommendationOutput:
        """
        Parses LLM response and validates against Pydantic schema.

        Args:
            raw_content: Raw JSON string from LLM

        Returns:
            Validated LLMRecommendationOutput object

        Raises:
            ValueError: If parsing or validation fails
        """
        try:
            # Strip markdown code fences if present
            content = raw_content.strip()
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]

            parsed = json.loads(content)
            validated = LLMRecommendationOutput(**parsed)
            return validated

        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing failed: {e}\nRaw content: {raw_content}")
            raise ValueError(f"Invalid JSON from LLM: {str(e)}")

        except Exception as e:
            logger.error(f"Validation failed: {e}")
            raise ValueError(f"LLM output validation error: {str(e)}")

    def generate_recommendation(self, deal_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Main entry point: generates recommendation for a single deal.

        Args:
            deal_data: Fused payload with ML prediction + custom fields

        Returns:
            Dict containing validated recommendation + metadata
        """
        try:
            # 1. Build prompt messages
            messages = build_llm_prompt(deal_data)

            # 2. Call LLM API
            api_response = self._call_llm_api(messages)

            # 3. Parse and validate response
            validated_output = self._parse_and_validate(api_response["content"])

            # 4. Package final result
            result = {
                # Core outputs
                "adjusted_probability": validated_output.adjusted_probability,
                "recommendation_ar": validated_output.recommendation_ar,
                "recommendation_en": validated_output.recommendation_en,
                "risk_flag": validated_output.risk_flag,
                "risk_reasoning": validated_output.risk_reasoning,
                # Metadata
                "llm_model_id": self.model_id,
                "prompt_version": PROMPT_VERSION,
                "llm_latency_ms": api_response["latency_ms"],
                "llm_tokens_used": api_response["tokens_used"],
                # Store input payload for debugging
                "llm_payload": deal_data,
                # Base probability for delta calculation
                "base_probability": deal_data.get("base_probability", 0.0),
            }

            logger.info(
                f"Generated recommendation for deal {deal_data.get('deal_id', 'unknown')}: "
                f"base={result['base_probability']:.2f} → "
                f"adjusted={result['adjusted_probability']:.2f}"
            )

            return result

        except Exception as e:
            logger.error(
                f"Recommendation generation failed for deal "
                f"{deal_data.get('deal_id', 'unknown')}: {str(e)}"
            )

            # Fallback: return base probability with no adjustment
            return self._create_fallback_response(deal_data, error=str(e))

    def _create_fallback_response(
        self, deal_data: Dict[str, Any], error: str
    ) -> Dict[str, Any]:
        """
        Creates a safe fallback response when LLM fails.
        """
        base_prob = deal_data.get("base_probability", 0.5)

        return {
            "adjusted_probability": base_prob,
            "recommendation_ar": "لم يتم إنشاء توصية (خطأ في النظام). استخدم النتيجة الأساسية للنموذج.",
            "recommendation_en": "Recommendation generation failed (system error). Use base ML score.",
            "risk_flag": "NONE",
            "risk_reasoning": None,
            "llm_model_id": self.model_id,
            "prompt_version": PROMPT_VERSION,
            "llm_latency_ms": 0,
            "llm_tokens_used": 0,
            "llm_payload": deal_data,
            "base_probability": base_prob,
            "error": error,
            "is_fallback": True,
        }


# --- Factory Function ---
def create_recommender_service() -> LLMRecommenderService:
    """
    Factory function to instantiate the recommender with config.
    """
    return LLMRecommenderService(
        # Change this line below:
        api_key=settings.LLM_API_KEY,
        base_url=settings.LLM_BASE_URL,
        model_id=settings.LLM_MODEL_ID,
        max_tokens=settings.LLM_MAX_TOKENS,
        temperature=settings.LLM_TEMPERATURE,
    )
