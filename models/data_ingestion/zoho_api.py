# This script let us to pull our Deals and look at the schema.
import requests
import os
import json
from dotenv import load_dotenv
import pandas as pd

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
        "refresh_token": REFRESH_TOKEN,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "grant_type": "refresh_token",
    }
    response = requests.post(url, data=payload)
    # Check if the request was successful
    if response.status_code == 200:
        access_token = response.json().get("access_token")
        print("✅ Success! Token generated.")
        return access_token
    else:
        print(
            f"❌ Error: Zoho rejected the request (Status Code {response.status_code})"
        )
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
    headers = {"Authorization": f"Zoho-oauthtoken {access_token}"}

    # The fields we want to pull from Zoho API
    # THE FIX: Added Account_Name, Contact_Name, and Owner
    params = {
        "fields": "Deal_Name,Amount,Stage,Closing_Date,Probability,Expected_Revenue,Account_Name,Contact_Name,Owner"
    }

    response = requests.get(url, headers=headers, params=params)

    print("=== ZOHO API DEBUG ===")
    print(f"Status Code: {response.status_code}")
    print(f"Raw Text: {response.text}")
    print("======================")
    # ----------------------------
    if response.status_code == 200:
        data = response.json()
        print("✅ Successfully connected to Zoho CRM!")
        print("=== DEALS DATA SCHEMA ===")
        # We print just the first deal beautifully formatted so you can study the fields
        if "data" in data and len(data["data"]) > 0:
            # you can add a new deal in your Zoho CRM to see how it appears in the JSON and test the schema flexibility. Just make sure to run this script again after adding the deal to see the new schema in action.
            # you can control the number of records printed by changing the index below (currently set to 0 for the first deal)
            print(json.dumps(data["data"], indent=4))

            # save the JSON
            with open("real_sample_deals.json", "w") as f:
                json.dump(data["data"], f)
            # Return the raw array of deals
            return data["data"]
        else:
            print("No deals found in your CRM. Please add a dummy deal in Zoho first.")
    else:
        print(f"❌ Error: {response.status_code}")
        print(response.text)


def flatten_deals_to_csv(raw_deals, output_filename="historical_deals.csv"):
    """3. TRANSFORMATION: Flattens the raw JSON and saves it as a CSV."""
    print("⚙️ Transforming JSON into a flat structure...")
    flat_deals = []

    for deal in raw_deals:
        flat_deal = {
            "Deal_ID": deal.get("id"),
            "Deal_Name": deal.get("Deal_Name"),
            "Amount": deal.get("Amount", 0),
            "Expected_Revenue": deal.get("Expected_Revenue") or 0,
            "Probability": deal.get("Probability", 0),
            "Stage": deal.get("Stage"),
            "Closing_Date": deal.get("Closing_Date"),
            # Flatten the nested dictionaries safely
            "Account_Name": (
                deal.get("Account_Name", {}).get("name")
                if deal.get("Account_Name")
                else "Unknown"
            ),
            "Contact_Name": (
                deal.get("Contact_Name", {}).get("name")
                if deal.get("Contact_Name")
                else "Unknown"
            ),
            "Owner_Name": (
                deal.get("Owner", {}).get("name") if deal.get("Owner") else "Unknown"
            ),
            "custom_fields": (
                deal.get("Custom_Fields")
                if deal.get("Custom_Fields") is not None
                else {}
            ),
        }
        flat_deals.append(flat_deal)

    # Convert to DataFrame and save
    df = pd.DataFrame(flat_deals)
    df.to_csv(output_filename, index=False)
    print(f"💾 Data transformation complete! Saved to '{output_filename}'.")


if __name__ == "__main__":
    fetch_deals_schema()
    # Read my saved Zoho JSON file

    with open("real_sample_deals.json", "r") as f:
        real_json_data = json.load(f)

    # Pass it to your function
    flatten_deals_to_csv(real_json_data, "test_deals.csv")
# Run the Script
# python models/data_ingestion/zoho_api.py
