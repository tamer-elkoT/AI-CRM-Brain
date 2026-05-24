This is a professional **Data Catalog** for your `zoho_deals` and `ml_predictions` tables. You can copy the content below directly into a new file in your project (e.g., `docs/database_catalog.md`) and it will render perfectly in VS Code's Markdown preview.

---

# AI CRM Brain — Data Catalog

This document defines the schema and business logic for the core persistence layer of the AI CRM Brain.

---

## 1. Table: `zoho_deals`

**Purpose:** Stores the raw deal information ingested from Zoho CRM. This acts as the primary data source for the dashboard and the feature input for the ML Engine.

| Column Name | Data Type | Nullable | Description | Business Benefit |
| --- | --- | --- | --- | --- |
| `id` | String | False | Primary Key. Zoho CRM Unique Deal ID. | Unique identifier for cross-referencing Zoho and local data. |
| `deal_name` | String | False | The descriptive name of the deal. | Primary visual identifier for the Sales Rep. |
| `stage` | String | False | Current pipeline status (e.g., "Negotiation"). | Critical feature for ML model to understand deal progression. |
| `amount` | Float | False | Total financial value of the deal. | Direct impact on expected revenue and model weighting. |
| `closing_date` | DateTime | True | Target or actual close date. | Used for "Time-to-close" feature engineering. |
| `account_name` | String | True | Client company name. | Essential for customer-level insights and grouping. |
| `zoho_probability` | Float | True | The manual probability set by the CRM. | Benchmark for comparison against AI predictions. |
| `expected_revenue` | Float | False | Zoho-calculated expected value. | Financial reporting metric for the dashboard. |
| `contact_name` | String | True | Primary stakeholder contact. | Used in recommendation generation to personalize advice. |
| `owner_name` | String | True | The assigned Sales Rep. | Allows dashboard filtering by owner. |
| `custom_fields` | JSONB | True | Raw JSON blob of extra Zoho fields. | Future-proofs the model for additional features without schema changes. |

---

