## 2. Table: `ml_predictions`

**Purpose:** Stores the output of the Predictive Model. By storing predictions in a separate table, the dashboard can load instantly without re-running the ML model (Inference).

| Column Name | Data Type | Nullable | Description | Business Benefit |
| --- | --- | --- | --- | --- |
| `id` | String | False | Primary Key (UUID). | Unique ID for the specific prediction event. |
| `deal_id` | String | False | Foreign Key to `zoho_deals`. | Links the prediction to the specific deal. |
| `predicted_stage_encoded` | Integer | True | Numeric representation of predicted outcome. | Allows for fast sorting of "Likely to Win" deals. |
| `base_probability` | Float | False | The % likelihood of the deal closing. | The core "North Star" metric for the dashboard. |
| `confidence_all_classes` | JSONB | True | Probability scores for all potential stages. | Provides granularity (e.g., "Stalled" vs "Lost"). |
| `feature_vector` | JSONB | True | Stores the specific inputs used for this prediction. | **Sprint 4 Critical:** Injected into LLM prompt to explain *why* the score is high/low. |
| `prediction_date` | DateTime | False | Timestamp of prediction generation. | Helps track model drift over time. |
| `updated_at` | DateTime | False | Last time the inference was run. | Ensures data freshness in the UI. |

---

## Architecture & Relationships

### Why this structure works:

1. **Decoupling (MVC):** Your `zoho_deals` table is strictly for **Storage**, while the `ml_predictions` table is strictly for **Insights**. This allows your frontend (Streamlit) to query only the necessary data.
2. **Persistence (Sprint 4 Readiness):** - When you begin **Sprint 4 (LLM Integration)**, you will add the `llm_recommendations` table.
* You will then perform a **JOIN** query: `Zoho Deals` (Metadata) + `ML Predictions` (Scores) + `LLM Recommendations` (Advice) = **The Full Sales View**.


3. **Storage Efficiency:** Storing the `feature_vector` as `JSONB` in the `ml_predictions` table is a performance hack. Instead of recalculating features on the fly, your LLM agent will simply grab the already-calculated `feature_vector` from the DB and pass it directly to Claude/OpenAI.

### Next Steps for Implementation

1. **Migrations:** Create a new Alembic revision for these models.
2. **Indexing:** Note that `deal_id` in `ml_predictions` is `unique=True`. This is excellent for performance as it ensures `UPSERT` operations are fast and keeps the DB clean of duplicate historical predictions.
3. **Validation:** Ensure your `predict_batch()` function includes a validation step that checks if the record exists in `zoho_deals` before attempting to insert into `ml_predictions`.

---

**Does this catalog meet your requirements for your documentation, or would you like to add specific fields for activity logging (e.g., `call_count`, `email_frequency`) to be ready for the V2 features?**