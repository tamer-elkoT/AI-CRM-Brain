from fastapi import FastAPI, HTTPException, Query
from models.data_ingestion.zoho_api import get_new_access_token
import requests

app = FastAPI(title="AI CRM Brain - Internal Diagnostic API")


@app.post("/api/v1/test/fetch-records", tags=["Diagnostics"])
def fetch_records(
    limit: int = Query(
        default=5, ge=1, le=100, description="Number of rows/records to return"
    )
):
    """
    Diagnostic Endpoint: Safely handles background authentication, requests
    live data from Zoho CRM, and returns a slice of the raw payload to verify connectivity.
    """
    # 1. Automate token generation internally using the Refresh Token in your .env
    access_token = get_new_access_token()
    if not access_token:
        raise HTTPException(
            status_code=401,
            detail="Authentication failed: Unable to fetch fresh Zoho Access Token.",
        )

    # 2. Configure the Zoho request
    url = "https://www.zohoapis.com/crm/v3/Deals"
    headers = {"Authorization": f"Zoho-oauthtoken {access_token}"}
    params = {
        "fields": "Deal_Name,Amount,Stage,Closing_Date,Probability,Expected_Revenue,Account_Name,Contact_Name,Owner",
        "per_page": limit,  # Tells Zoho exactly how many rows you want
    }

    try:
        # 3. Request live data
        response = requests.get(url, headers=headers, params=params)

        if response.status_code == 200:
            payload = response.json()
            deals = payload.get("data", [])

            # 4. Return summary metadata and the list of deals
            return {
                "status": "success",
                "message": "Connected to Zoho successfully!",
                "requested_rows": limit,
                "returned_rows": len(deals),
                "data": deals,
            }

        elif response.status_code == 204:  # Zoho uses 204 for empty datasets
            return {
                "status": "success",
                "message": "Connected to Zoho successfully, but no deals exist in the CRM.",
                "data": [],
            }
        else:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Zoho API error: {response.text}",
            )

    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=500, detail=f"Network connectivity issue: {str(e)}"
        )
