import requests

# This script to access an api token from zoho

CLIENT_ID = "1000.2T3EO29ECBJEEM6TW8UR0WWDO5N54E"
CLIENT_SECRET = "7f46bf8c57d629ee08159828483541de49453837f8"
# to get the Grant Token go to https://api-console.zoho.com/
# and create a new client, then use the generated code in the url below to get the token
# the scope should be set to "ZohoCRM.modules.ALL"
GRANT_TOKEN = "1000.4e437f661df9b4b6261834c40ebf1b9e.353d52d2b709f8ced05761e33029ba80"

url = "https://accounts.zoho.com/oauth/v2/token"

payload = {
    "grant_type": "authorization_code",
    "client_id": CLIENT_ID,
    "client_secret": CLIENT_SECRET,
    "code": GRANT_TOKEN,
}

response = requests.post(url, data=payload)
tokens = response.json()

print("=== YOUR ZOHO TOKENS ===")
print(tokens)
