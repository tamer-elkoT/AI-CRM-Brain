from fastapi.testclient import TestClient
from app import app
import sys

client = TestClient(app)

response = client.post(
    "/api/v1/auth/signup",
    json={"email": "test@test.com", "password": "password123", "name": "Test User"}
)

print(response.status_code)
print(response.json())
