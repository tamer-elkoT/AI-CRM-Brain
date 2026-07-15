import asyncio
import httpx
from config import settings
from controllers.followup_controller import generate_client_message
from models.database import SessionLocal
from models.api_schemas import GenerateMessageRequest
from models.schema import ZohoDeal

async def test():
    db = SessionLocal()
    deal = db.query(ZohoDeal).first()
    prompt = f"Say hello to my client {deal.contact_name}."
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"{settings.LLM_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.LLM_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "openrouter/free",
                    "messages": [
                        {"role": "user", "content": prompt},
                    ]
                }
            )
            print("Response:", res.json())
    except Exception as e:
        print("Error:", e)
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test())
