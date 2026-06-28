"""
Prompt templates for LLM-based sales recommendation generation.
"""

from typing import Dict, List, Any

# Prompt version for tracking experiments
PROMPT_VERSION = "v1.0"

SYSTEM_PROMPT = """You are an expert AI Sales Strategist for a CRM analytics platform serving Arabic-speaking markets.

Your task is to evaluate a sales deal and provide:
1. **adjusted_probability** (float, 0.00-1.00): A refined closure probability that considers contextual factors the ML model cannot see (custom fields, qualitative signals).
2. **recommendation_ar** (string): A concise, actionable 2-3 sentence "Next Best Action" in Arabic for the sales representative.
3. **recommendation_en** (string, optional): English translation of the recommendation.
4. **risk_flag** (string, optional): One of ['HIGH_RISK', 'COMPETITOR_PRESENT', 'STALLED', 'BUDGET_UNCERTAIN', 'NONE']
5. **risk_reasoning** (string, optional): Brief explanation if risk_flag is not NONE.

**Adjustment Guidelines:**
- If custom fields indicate strong buying signals (budget approved, no competitors, decision maker engaged) → increase probability
- If red flags present (long silence, multiple postponements, competitor mentioned) → decrease probability
- Keep adjustments reasonable: typically ±5-15 percentage points from base_probability
- Never adjust above 0.95 or below 0.05

**CRITICAL INSTRUCTION**: You MUST output ONLY valid JSON. Absolutely NO reasoning, NO text, NO markdown, and NO preamble before or after the JSON. If you include any text outside the curly braces { }, the system will crash.

**Output ONLY valid JSON** in this exact schema:
{
  "adjusted_probability": <float>,
  "recommendation_ar": "<Arabic text>",
  "recommendation_en": "<English text>",
  "risk_flag": "<flag or NONE>",
  "risk_reasoning": "<explanation if risk_flag != NONE>"
}
"""


FEW_SHOT_EXAMPLES: List[Dict[str, Any]] = [
    {
        "input": {
            "deal_name": "Enterprise CRM Implementation",
            "base_probability": 0.82,
            "stage": "Negotiation",
            "amount": 48000,
            "days_to_close": 7,
            "account_name": "TechFlow Inc.",
            "owner_name": "Ahmed Hassan",
            "custom_fields": {
                "Competitor_Present": "None",
                "Budget_Approved": "Yes",
                "Decision_Maker_Engaged": "Yes",
                "Last_Contact_Days_Ago": 2,
            },
        },
        "output": {
            "adjusted_probability": 0.91,
            "recommendation_ar": "الصفقة في مرحلة متقدمة جداً والميزانية مؤكدة. تواصل مع صاحب القرار في TechFlow خلال 48 ساعة لإتمام التوقيع النهائي. لا يوجد منافسين حالياً - استغل هذه الفرصة الذهبية.",
            "recommendation_en": "Deal is in advanced stage with confirmed budget. Contact TechFlow decision maker within 48 hours to finalize signature. No competitors present - leverage this golden opportunity.",
            "risk_flag": "NONE",
            "risk_reasoning": None,
        },
    },
    {
        "input": {
            "deal_name": "Q3 Software Renewal",
            "base_probability": 0.65,
            "stage": "Proposal/Price",
            "amount": 22000,
            "days_to_close": 18,
            "account_name": "AlTech Solutions",
            "owner_name": "Sara Mohamed",
            "custom_fields": {
                "Competitor_Present": "CompetitorX mentioned",
                "Budget_Approved": "Under Review",
                "Decision_Maker_Engaged": "No",
                "Last_Contact_Days_Ago": 12,
            },
        },
        "output": {
            "adjusted_probability": 0.48,
            "recommendation_ar": "تحذير: لم يتم التواصل منذ 12 يوم ويوجد منافس. اتصل فوراً بصاحب القرار في AlTech لفهم اعتراضاتهم ومقارنة عرضنا بالمنافس. قدم دراسة حالة مشابهة لبناء الثقة.",
            "recommendation_en": "Warning: 12 days since last contact and competitor present. Call AlTech decision maker immediately to understand objections and compare our offer. Present similar case study to build trust.",
            "risk_flag": "COMPETITOR_PRESENT",
            "risk_reasoning": "Competitor mentioned and decision maker not engaged for 12 days - high risk of losing deal",
        },
    },
    {
        "input": {
            "deal_name": "SMB Onboarding Package",
            "base_probability": 0.38,
            "stage": "Qualification",
            "amount": 8500,
            "days_to_close": 45,
            "account_name": "QuickMart",
            "owner_name": "Khaled Ali",
            "custom_fields": {
                "Competitor_Present": "Unknown",
                "Budget_Approved": "No",
                "Decision_Maker_Engaged": "No",
                "Last_Contact_Days_Ago": 8,
                "Meeting_Cancelled_Count": 2,
            },
        },
        "output": {
            "adjusted_probability": 0.22,
            "recommendation_ar": "الصفقة في خطر: تم إلغاء اجتماعين والميزانية غير محددة. أعد تقييم الأولوية - ربما يكون QuickMart غير جاهز للشراء حالياً. ركز جهودك على صفقات ذات احتمالية أعلى.",
            "recommendation_en": "Deal at risk: 2 cancelled meetings and no budget confirmed. Re-evaluate priority - QuickMart may not be ready to buy. Focus efforts on higher probability deals.",
            "risk_flag": "STALLED",
            "risk_reasoning": "Multiple meeting cancellations and lack of budget approval indicate low buyer intent",
        },
    },
    {
        "input": {
            "deal_name": "Annual License Expansion",
            "base_probability": 0.71,
            "stage": "Value Proposition",
            "amount": 35000,
            "days_to_close": 25,
            "account_name": "Nexus LLC",
            "owner_name": "Fatima Nour",
            "custom_fields": {
                "Competitor_Present": "None",
                "Budget_Approved": "Yes",
                "Decision_Maker_Engaged": "Yes",
                "Last_Contact_Days_Ago": 5,
                "Existing_Customer": "Yes",
            },
        },
        "output": {
            "adjusted_probability": 0.78,
            "recommendation_ar": "عميل حالي مع ميزانية مؤكدة - فرصة توسع ممتازة. جهز عرض تقديمي يوضح ROI من الترخيص السابق. اطلب موعد للعرض النهائي خلال أسبوع لتسريع الإغلاق.",
            "recommendation_en": "Existing customer with confirmed budget - excellent expansion opportunity. Prepare presentation showing ROI from previous license. Request meeting for final presentation within one week to accelerate closure.",
            "risk_flag": "NONE",
            "risk_reasoning": None,
        },
    },
]


def build_llm_prompt(deal_data: Dict[str, Any]) -> List[Dict[str, str]]:
    """
    Constructs the messages array for Groq API.

    Args:
        deal_data: Fused deal payload with ML prediction + custom fields

    Returns:
        List of message dicts in Groq format
    """
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Add few-shot examples
    for example in FEW_SHOT_EXAMPLES:
        user_msg = f"""Deal Analysis Request:
{format_deal_input(example['input'])}"""

        assistant_msg = format_json_output(example["output"])

        messages.append({"role": "user", "content": user_msg})
        messages.append({"role": "assistant", "content": assistant_msg})

    # Add the actual deal to analyze
    actual_request = f"""Deal Analysis Request:
{format_deal_input(deal_data)}"""

    messages.append({"role": "user", "content": actual_request})

    return messages


def format_deal_input(data: Dict[str, Any]) -> str:
    """Formats deal data into readable text for LLM."""
    return f"""
Deal Name: {data.get('deal_name', 'Unknown')}
ML Base Probability: {data.get('base_probability', 0.0):.2f}
Stage: {data.get('stage', 'Unknown')}
Amount: ${data.get('amount', 0):,.0f}
Days to Close: {data.get('days_to_close', 'Unknown')}
Account: {data.get('account_name', 'Unknown')}
Owner: {data.get('owner_name', 'Unknown')}

Custom Fields:
{format_custom_fields(data.get('custom_fields', {}))}
""".strip()


def format_custom_fields(fields: Dict[str, Any]) -> str:
    """Pretty-print custom fields."""
    if not fields:
        return "  (None)"
    return "\n".join(f"  - {k}: {v}" for k, v in fields.items())


def format_json_output(output: Dict[str, Any]) -> str:
    """Formats the expected JSON output."""
    import json

    return json.dumps(output, ensure_ascii=False, indent=2)
