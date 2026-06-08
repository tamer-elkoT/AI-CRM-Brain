import os
from models.database import SessionLocal
from models.schema import User, ZohoDeal

db = SessionLocal()
users = db.query(User).all()
for u in users:
    print(f"User: {u.name}, Role: {u.role}, Phone: {u.phone_number}, WhatsApp Verified: {u.is_whatsapp_verified}")

deals = db.query(ZohoDeal).all()
for d in deals:
    print(f"Deal: {d.deal_name}, Owner: {d.owner_name}, Client Phone: {d.client_phone}, Client Email: {d.client_email}")
