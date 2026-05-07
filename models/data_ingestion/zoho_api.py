# This script let us to pull our Deals and look at the schema.
import requests
import os 
import json 
from dotenv import load_dotenv

# Load credentials from .env file
load_dotenv()

CLIENT_ID = os.getenv("ZOHO_CLIENT_ID")
CLIENT_SECRET = os.getenv("ZOHO_CLIENT_SECRET")
REFRESH_TOKEN = os.getenv("ZOHO_REFRESH_TOKEN")

def get_new_access_token():
    """Uses the refresh token to get a fresh access token.
    This function takes your permanent REFRESH_TOKEN and asks Zoho's server (https://accounts.zoho.com/oauth/v2/token) for a brand new, valid Access Token.

    It returns this new token so the rest of the script can use it to fetch data
    """
    url = "https://accounts.zoho.com/oauth/v2/token"
    payload = {
        'refresh_token': REFRESH_TOKEN,
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET,
        'grant_type': 'refresh_token'
    }
    response = requests.post(url, data=payload)
    # Check if the request was successful
    if response.status_code == 200:
        access_token = response.json().get('access_token')
        print("✅ Success! Token generated.")
        return access_token
    else:
        print(f"❌ Error: Zoho rejected the request (Status Code {response.status_code})")
        print(f"Details: {response.text}")
        return None
        

# Testing the function get_new_access_token()

if __name__ == "__main__":
    print("=== TESTING TOKEN GENERATION ===")
    test_token = get_new_access_token()
    
    if test_token:
        print(f"Your fresh Access Token is: {test_token}")
        print("Your background authentication system is 100% ready!")
    print("================================")





def fetch_deals_schema():
    """Fetches the first 5 deals to analyze the JSON schema."""
    access_token = get_new_access_token()
    
    if not access_token:
        print("Failed to get access token.")
        return

    # Change zohoapis.com to zohoapis.eu or .in if your account is not US-based
    url = "https://www.zohoapis.com/crm/v3/Deals"
    
    # place the access_token for zoho into the header 
    headers = {
        'Authorization': f'Zoho-oauthtoken {access_token}'
    }
    
    # The fields we want to pull from Zoho API
    # THE FIX: Added Account_Name, Contact_Name, and Owner
    params = {
        'fields': 'Deal_Name,Amount,Stage,Closing_Date,Probability,Expected_Revenue,Account_Name,Contact_Name,Owner'
    }



    response = requests.get(url, headers=headers, params=params)
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Successfully connected to Zoho CRM!")
        print("=== DEALS DATA SCHEMA ===")
        # We print just the first deal beautifully formatted so you can study the fields
        if 'data' in data and len(data['data']) > 0:
            print(json.dumps(data['data'][0], indent=4))
        else:
            print("No deals found in your CRM. Please add a dummy deal in Zoho first.")
    else:
        print(f"❌ Error: {response.status_code}")
        print(response.text)

if __name__ == "__main__":
    fetch_deals_schema()

# Run the Script
# python models/data_ingestion/zoho_api.py