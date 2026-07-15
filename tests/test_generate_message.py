import asyncio
import httpx
from config import settings
from controllers.followup_controller import generate_client_message
from models.database import SessionLocal
from models.api_schemas import GenerateMessageRequest

async def test():
    db = SessionLocal()
    req = GenerateMessageRequest(sales_rep_name="Tamer Elkot")
    try:
        res = await generate_client_message(deal_id="7463257000000609571", request=req, db=db)
        print("Success:", res)
    except Exception as e:
        print("Error:", e)
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test())
