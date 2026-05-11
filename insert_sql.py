# Read the data from the CSV file and insert it into the database using raw SQL commands.

import csv
from sqlalchemy import text
from models.database import SessionLocal

def insert_deals_with_sql(csv_filename):
    # 1. Open a connection/session to the database
    db = SessionLocal()

    # 2. Write the raw SQL command (using parameterized variables like :id to prevent SQL injection)
    sql_query = text("""
        INSERT INTO zoho_deals (id, deal_name, stage, amount, closing_date, zoho_probability, expected_revenue, contact_name, owner_name)
        VALUES (:id, :deal_name, :stage, :amount, :closing_date, :zoho_probability, :expected_revenue, :contact_name, :owner_name)

        -- If the Deal ID already exists, just update the numbers!
        ON CONFLICT (id) DO UPDATE 
        SET deal_name = EXCLUDED.deal_name,
            stage = EXCLUDED.stage,
            amount = EXCLUDED.amount,
            closing_date = EXCLUDED.closing_date,
            zoho_probability = EXCLUDED.zoho_probability,
            expected_revenue = EXCLUDED.expected_revenue,
            contact_name = EXCLUDED.contact_name,
            owner_name = EXCLUDED.owner_name;
    """)

    print("🚀 Executing SQL Commands...")

    try:
        # 3. Read your flat CSV data
        with open(csv_filename, mode='r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            
            # 4. Loop through each row and fire the SQL command
            for row in reader:
                db.execute(sql_query, {
                    "id": str(row["Deal_ID"]), # Match these exact keys to your CSV headers
                    "deal_name": str(row["Deal_Name"]),
                    "stage": str(row["Stage"]),
                    "amount": float(row["Amount"]) if row["Amount"] else 0.0,
                    "closing_date": row["Closing_Date"] if row["Closing_Date"] else None,
                    "zoho_probability": float(row["Probability"]) if row["Probability"] else 0.0,
                    "expected_revenue": float(row["Expected_Revenue"]) if row["Expected_Revenue"] else 0.0,
                    "contact_name": str(row["Contact_Name"]) if row["Contact_Name"] else None,
                    "owner_name": str(row["Owner_Name"]) if row["Owner_Name"] else None
                })
        
        # 5. COMMIT the transaction to permanently save the data
        db.commit()
        print("✅ All deals inserted successfully using raw SQL!")

    except Exception as e:
        # If something breaks, undo the changes
        db.rollback()
        print(f"❌ Error during SQL execution: {e}")
    finally:
        # Always close the database connection
        db.close()

if __name__ == "__main__":
    # Point this to the CSV file you generated from your zoho_api.py script
    csv_file = "/mnt/d/01_Projects/NLP/AI CRM Brain/AI-CRM-Brain/test_deals.csv"
    insert_deals_with_sql(csv_file)