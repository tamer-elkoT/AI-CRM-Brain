import asyncio
import httpx
from config import settings

async def test():
    prompt = "Generate a WhatsApp message."
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"{settings.LLM_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.LLM_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost:5173",
                    "X-Title": "AI CRM Brain",
                },
                json={
                    "model": "openrouter/free",
                    "messages": [
                        {"role": "system", "content": "You are an expert B2B sales communication specialist."},
                        {"role": "user", "content": prompt},
                    ],
                    "max_tokens": 300,
                    "temperature": 0.7,
                }
            )
            print("Response:", res.json())
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(test())
