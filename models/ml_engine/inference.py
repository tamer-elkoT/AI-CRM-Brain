import pickle
import json
import pandas as pd
import numpy as np
from pathlib import Path

# Resolve paths relative to this file's location so the code works in
# any environment: local Windows/WSL dev AND inside Docker (/app/...).
_BASE_DIR   = Path(__file__).resolve().parent.parent.parent  # → project root
WEIGHTS_DIR   = _BASE_DIR / "weights"
ARTIFACTS_DIR = _BASE_DIR / "artifacts"

# Load Artefacts globally so they stay in memory when the API starts
with open(WEIGHTS_DIR / "random_forest_v1.pkl", "rb") as f:
    rf_model = pickle.load(f)

with open(ARTIFACTS_DIR / "standard_scaler.pkl", "rb") as f:
    scaler = pickle.load(f)

# 1. Load the Configuration JSON
with open(ARTIFACTS_DIR / "feature_columns.json", "r") as f:
    freq_maps = json.load(f)

# Dynamically extract the lists and dictionaries
FEATURE_COLS = freq_maps["features"]
STAGE_MAPPING = freq_maps["stage_mapping"]

# print(f"✅ Model and artefacts loaded. Ready for inference on features: {FEATURE_COLS}")


def preprocess_new_deal(raw_deals: list[dict]) -> pd.DataFrame:
    """
    Transforms a single raw deal dictionary into a scaled feature
    vector ready for model inference.

    Args:
        raw_deal: dict with keys: Owner_Name, Account_Name, Amount, Closing_Date

    Returns:
        pd.DataFrame with one row, ready to pass to model.predict()
    """
    df = pd.DataFrame(raw_deals)

    # 1. Date Engineering
    df["Closing_Date"] = pd.to_datetime(df["Closing_Date"])
    # Assume Created_Time exists, or use a reference date like Phase 2
    reference_date = (
        df["Closing_Date"].min()
        if "Created_Time" not in df.columns
        else pd.to_datetime(df["Created_Time"])
    )

    df["Close_Year"] = df["Closing_Date"].dt.year
    df["Close_Month"] = df["Closing_Date"].dt.month
    df["Close_Quarter"] = df["Closing_Date"].dt.quarter
    df["Close_DayOfWeek"] = df["Closing_Date"].dt.dayofweek
    df["Deal_Age_Days"] = (df["Closing_Date"] - reference_date).dt.days

    # 2. Frequency Encoding (Handling unseen values gracefully with `.get()`)
    # Note: Ensure your loaded JSON dict is named 'freq_maps' matching your imports
    df["Owner_Freq"] = df["Owner_Name"].apply(
        lambda x: freq_maps.get("Owner_Name", {}).get(x, 1)
    )
    df["Account_Freq"] = df["Account_Name"].apply(
        lambda x: freq_maps.get("Account_Name", {}).get(x, 1)
    )

    # 3. Stage Mapping (Applied to the main dataframe, NOT the feature matrix)
    ZOHO_TO_ML_STAGE_MAP = {
        "Qualification": "Prospecting",
        "Needs Analysis": "Prospecting",
        "Value Proposition": "Engaging",
        "Identify Decision": "Engaging",
        "Proposal/Price": "Engaging",
        "Negotiation/review": "Engaging",
        "Closed Won": "Won",
        "Closed Lost": "Lost",
        "Closed Lost on Cempetition": "Lost",
    }

    # Safely map it so you can use it in your UI/API response later if needed
    if "Stage" in df.columns:
        df["Stage_Mapped"] = df["Stage"].map(ZOHO_TO_ML_STAGE_MAP)

    # 4. Filter exactly the columns the ML model expects, and scale them
    # .copy() ensures we avoid Pandas SettingWithCopy warnings
    X_raw = df[FEATURE_COLS].copy()

    # scaler was fitted strictly on FEATURE_COLS, so it will transform cleanly
    X_scaled = scaler.transform(X_raw)

    # Return as DataFrame to preserve column names
    return pd.DataFrame(X_scaled, columns=FEATURE_COLS)


# # Test the Preprocessing Function with a Sample Input
# if __name__ == "__main__":
#     sample_input = [
#         {
#             "Owner_Name": "Alice Johnson",
#             "Account_Name": "Acme Corp",
#             "Amount": 50000,
#             "Closing_Date": "2024-12-15",
#             "Stage": "Proposal/Price",
#         }
#     ]

#     preprocessed_df = preprocess_new_deal(sample_input)
#     print("Preprocessed DataFrame:")
#     print(preprocessed_df.head())


def predict_batch(deals_df: pd.DataFrame) -> list[dict]:
    """
    Vectorized inference. Returns predictions and the base_probability for 'Won'.
    """
    # The 'Won' class is index 3 based on your Phase 3 notebook STAGE_MAPPING
    WON_CLASS_INDEX = 3

    predictions = rf_model.predict(deals_df)
    probabilities = rf_model.predict_proba(deals_df)

    results = []
    for i in range(len(predictions)):
        results.append(
            {
                "predicted_stage_encoded": int(predictions[i]),
                "base_probability": float(probabilities[i][WON_CLASS_INDEX])
                * 100,  # % format
                "confidence_all_classes": probabilities[i].tolist(),
            }
        )

    return results
