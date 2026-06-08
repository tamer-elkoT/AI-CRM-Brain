"""
Debug script: Fetch deals from Zoho with ALL known fields 
to discover where phone/email actually live.
"""
import json
from models.data_ingestion.zoho_api import get_new_access_token
import requests

access_token = get_new_access_token()
if not access_token:
    print("Failed to get access token")
    exit(1)

headers = {"Authorization": f"Zoho-oauthtoken {access_token}"}

# STEP 1: Fetch deals with expanded fields including Phone, Mobile, Email
print("=" * 80)
print("DEALS (with Phone, Mobile, Email, Contact_Name)")
print("=" * 80)
url = "https://www.zohoapis.com/crm/v3/Deals"
params = {
    "fields": "Deal_Name,Amount,Stage,Closing_Date,Probability,Expected_Revenue,Account_Name,Contact_Name,Owner,Phone,Mobile,Email,Custom_Fields",
    "per_page": 3,
}
response = requests.get(url, headers=headers, params=params)
print(f"Status: {response.status_code}")

if response.status_code == 200:
    data = response.json()
    deals = data.get("data", [])
    for i, deal in enumerate(deals):
        print(f"\nDEAL #{i+1}: {deal.get('Deal_Name', 'N/A')}")
        print(json.dumps(deal, indent=2, default=str))
elif response.status_code == 400:
    print(f"Error 400: {response.text}")
    # Try without Custom_Fields since it may not exist
    params["fields"] = "Deal_Name,Amount,Stage,Closing_Date,Probability,Expected_Revenue,Account_Name,Contact_Name,Owner,Phone,Mobile,Email"
    response = requests.get(url, headers=headers, params=params)
    print(f"\nRetry Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        deals = data.get("data", [])
        for i, deal in enumerate(deals):
            print(f"\nDEAL #{i+1}: {deal.get('Deal_Name', 'N/A')}")
            print(json.dumps(deal, indent=2, default=str))
    else:
        print(f"Retry Error: {response.text}")
        # Try even more minimal
        params["fields"] = "Deal_Name,Contact_Name,Account_Name,Phone,Mobile,Email"
        response2 = requests.get(url, headers=headers, params=params)
        print(f"\nMinimal retry status: {response2.status_code}")
        print(response2.text[:500])
else:
    print(f"Error: {response.text}")

# STEP 2: Fetch contacts separately  
print("\n" + "=" * 80)
print("CONTACTS (Phone, Mobile, Email)")
print("=" * 80)
contacts_url = "https://www.zohoapis.com/crm/v3/Contacts"
contacts_params = {
    "fields": "Full_Name,Phone,Mobile,Email,First_Name,Last_Name",
    "per_page": 5,
}
contacts_resp = requests.get(contacts_url, headers=headers, params=contacts_params)
print(f"Status: {contacts_resp.status_code}")

if contacts_resp.status_code == 200:
    contacts_data = contacts_resp.json()
    contacts = contacts_data.get("data", [])
    for i, contact in enumerate(contacts):
        print(f"\nCONTACT #{i+1}:")
        print(json.dumps(contact, indent=2, default=str))
else:
    print(f"Error: {contacts_resp.text}")
