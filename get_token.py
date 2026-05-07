import requests

# --- FILL THESE IN ---
CLIENT_ID = "1000.2T3EO29ECBJEEM6TW8UR0WWDO5N54E"
CLIENT_SECRET = "7f46bf8c57d629ee08159828483541de49453837f8"
GRANT_TOKEN = "1000.79891270e4be2f9d06f9899a57fca7ce.4c394b2140314dbe2a5799f46e2e15ae"

# Note: If your Zoho account is in Europe (.eu) or India (.in), change zoho.com below to zoho.eu or zoho.in
url = "https://accounts.zoho.com/oauth/v2/token"

payload = {
    'grant_type': 'authorization_code',
    'client_id': CLIENT_ID,
    'client_secret': CLIENT_SECRET,
    'code': GRANT_TOKEN
}

response = requests.post(url, data=payload)
tokens = response.json()

print("=== YOUR ZOHO TOKENS ===")
print(tokens)