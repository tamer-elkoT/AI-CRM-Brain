# AI CRM Brain — Complete System Architecture & Developer Guide

> **Document Purpose:** A mentor-level, end-to-end breakdown of every file, class, and function in the AI CRM Brain codebase. Written so you can confidently edit, extend, and maintain this system without AI assistance.
>
> **Stack:** FastAPI · PostgreSQL · SQLAlchemy · XGBoost · Groq LLM · React (Sprint 5)
> **Pattern:** MVC (Model-View-Controller)
> **Scope:** Zoho CRM — Deals Module (MVP v1.0)

---

## Part 1 — The Big Picture: What This System Does

Think of this system as a **smart assistant for sales managers**. Without it, a manager looks at a list of 50 deals and has to manually guess which ones are most likely to close. With it, the system automatically:

1. **Pulls** fresh deal data from Zoho CRM every 30 minutes
2. **Scores** each deal using a machine learning model (XGBoost) — outputting a closure probability like "72%"
3. **Enriches** that score using an LLM (Groq/Llama) — which reads qualitative signals (budget status, competitors, days since last contact) and adjusts the probability AND writes a 2–3 sentence Arabic recommendation
4. **Displays** everything on a ranked dashboard so the sales rep knows exactly where to spend their energy

---

## Part 2 — The MVC Architecture Explained

MVC stands for **Model–View–Controller**. It is a separation-of-concerns pattern. Think of it like a restaurant:

| MVC Layer | Restaurant Analogy | In This Project |
|---|---|---|
| **Model** | The kitchen — holds ingredients and cooks food | `models/` — database tables, ML model, LLM service |
| **View** | The dining room — what the customer sees | `views/` — React dashboard (Sprint 5) |
| **Controller** | The waiter — takes orders, relays to kitchen, brings food back | `controllers/` — FastAPI route handlers |

This separation means you can swap out the database without touching the frontend, or redesign the dashboard without touching any ML code.

---

## Part 3 — File-by-File Breakdown

### 3.1 `app.py` — The Entry Point

**Responsibility:** Starts the FastAPI web server and registers all routes.

```python
# Simplified mental model of what app.py does:
app = FastAPI()
app.include_router(ingestion_controller.router)    # Zoho data pull routes
app.include_router(ml_controller.router)           # ML prediction routes
app.include_router(recommendation_controller.router) # LLM recommendation routes
```

**How it works:** When you run `python app.py`, FastAPI starts listening on port 8000. Every HTTP request (GET, POST, PATCH) that arrives is handed to the correct controller based on the URL path. Think of `app.py` as the front desk receptionist who directs all visitors to the right department.

**Key detail:** The `prefix="/api/v1"` on each router means every endpoint is namespaced. So `/ingest/deals` becomes `/api/v1/ingest/deals`. This makes versioning easy — a future v2 can co-exist without breaking existing clients.

---

### 3.2 `config.py` — The Settings Loader

**Responsibility:** Reads environment variables from your `.env` file and makes them available as typed Python objects throughout the entire application.

```python
# .env file has:
# LLM_API_KEY=gsk_xxx
# POSTGRES_USER=tamer

# config.py turns this into:
settings.LLM_API_KEY  # "gsk_xxx"
settings.POSTGRES_USER  # "tamer"
```

**Why this matters:** No credentials are hardcoded in source files. If you ever need to change your API key, you only change the `.env` file — not 10 different Python files. The `pydantic_settings.BaseSettings` class automatically validates that required values exist; if `LLM_API_KEY` is missing from `.env`, the app refuses to start with a clear error.


---

### 3.3 `models/database.py` — The Database Connection

**Responsibility:** Creates the SQLAlchemy engine that connects Python to PostgreSQL, and provides the `SessionLocal` factory for creating database sessions.

```python
# Analogy: database.py is like a phone book entry.
# It stores the address (connection URL) so every other file
# can "call" the database without knowing its internal setup.

engine = create_engine("postgresql://user:password@localhost:5433/ai_crm_brain")
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()  # All ORM models inherit from this
```

**Key concept — `SessionLocal`:** Every database read/write operation in FastAPI happens inside a "session" — like opening a conversation with the database. `SessionLocal()` creates one session. The `get_db()` pattern in every controller uses Python's `yield` to guarantee the session is always closed after the request, even if an error occurs.

---

### 3.4 `models/schema.py` — The Database Tables (ORM Models)

**Responsibility:** Defines the three database tables as Python classes. SQLAlchemy reads these class definitions and knows exactly what columns to create.

#### Table 1: `ZohoDeal` (maps to `zoho_deals` table)

The **source of truth** for all deal data. It serves two purposes simultaneously:
- **Training corpus**: Closed deals (where `is_closed_won` is TRUE or FALSE) teach the ML model
- **Active prediction queue**: Open deals (where `is_closed_won` is NULL) are scored on each batch run

**Critical column — `custom_fields` (JSONB):**
```python
custom_fields = Column(JSONB)
# Stores flexible key-value data, e.g.:
# {"Budget_Approved": "Yes", "Competitor_Present": "None", "Last_Contact_Days_Ago": 3}
```
This column is the bridge between Zoho and the LLM. The ML model never sees it (JSONB doesn't fit in a feature matrix), but the LLM reads it to understand the human context behind the numbers.

#### Table 2: `MLPrediction` (maps to `ml_predictions` table)

Stores the XGBoost model's output. One row per deal per batch run.

```python
base_probability = Column(Float, nullable=False)  # e.g., 0.7284 = 72.84%
feature_vector = Column(JSONB, nullable=True)     # {"amount_log": 10.3, "stage_encoded": 4}
```

**Why store `feature_vector`?** Two reasons:
1. **Auditability**: You can always replay the exact inputs that produced a given probability
2. **SHAP display**: The dashboard's "Why this score?" panel reads from this column to show the top contributing features

#### Table 3: `LLMRecommendation` (maps to `llm_recommendations` table)

The **final output surface** — what the React dashboard reads. Contains:

```python
adjusted_probability  # LLM's calibrated score (e.g., 0.89 after reading custom_fields)
adjusted_score_pct    # Computed: adjusted_probability * 100 (e.g., 89.00) — DB does the math
score_delta           # Computed: (adjusted - base) * 100 (e.g., +17 pts)
priority_tier         # Computed: 'HIGH' / 'MEDIUM' / 'LOW' based on threshold
recommendation_ar     # Arabic "Next Best Action" text
recommendation_en     # English translation (optional)
risk_flag             # 'COMPETITOR_PRESENT' / 'STALLED' / 'BUDGET_UNCERTAIN' / 'NONE'
rep_action_taken      # Boolean — closes the feedback loop when rep acts on advice
```

**Computed columns:** Notice `adjusted_score_pct`, `score_delta`, and `priority_tier` are marked `Computed(...)`. This means PostgreSQL calculates them automatically whenever a row is inserted or updated. Your Python code never has to compute these — the database handles it. This eliminates an entire class of bugs where the display value gets out of sync with the raw value.

---

### 3.5 `models/data_ingestion/zoho_api.py` — The Zoho Connector

**Responsibility:** Handles all communication with the Zoho CRM REST API.

#### Function: `get_new_access_token()`

Zoho uses OAuth 2.0 with a Refresh Token flow. Think of it like this:
- **Refresh Token**: A long-lived master key (never expires unless revoked) stored in `.env`
- **Access Token**: A short-lived visitor badge (expires in 1 hour) that you need for every API call

```python
# Every time you need to talk to Zoho, you first exchange
# your master key for a fresh visitor badge:
def get_new_access_token():
    response = requests.post("https://accounts.zoho.com/oauth/v2/token", data={
        "refresh_token": REFRESH_TOKEN,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "grant_type": "refresh_token"
    })
    return response.json()["access_token"]  # Valid for 1 hour
```

#### Function: `fetch_deals_schema()`

Calls `GET /crm/v3/Deals` to pull deal records. The `fields` parameter tells Zoho exactly which columns to return (reduces payload size).

#### Function: `flatten_deals_to_csv()`

Zoho returns nested JSON like:
```json
{"Account_Name": {"id": "12345", "name": "TechFlow Inc."}}
```

This function flattens it to:
```python
{"Account_Name": "TechFlow Inc."}  # Ready for database insertion
```

---

### 3.6 `controllers/ingestion_controller.py` — The Data Pipeline Endpoint

**Responsibility:** Exposes `POST /api/v1/ingest/deals` — when called, triggers a full Zoho pull and upserts all deals into PostgreSQL.

**The Upsert Pattern (critical concept):**

A regular `INSERT` fails if the deal already exists. An `UPDATE` fails if it doesn't yet exist. An **upsert** (INSERT ... ON CONFLICT DO UPDATE) handles both cases atomically:

```python
stmt = insert(ZohoDeal).values(**flattened_record)
upsert_stmt = stmt.on_conflict_do_update(
    index_elements=["id"],      # If this Zoho ID already exists...
    set_=update_dict            # ...update these columns instead of crashing
)
db.execute(upsert_stmt)
```

This makes the pipeline **idempotent** — you can safely run it 100 times and the database stays consistent. No duplicate rows, no errors.

---

### 3.7 `models/ml_engine/inference.py` — The ML Inference Engine

**Responsibility:** Loads the trained Random Forest model from disk and runs batch predictions on deal data.

**At startup**, the module loads three artifacts into RAM:
```python
rf_model = pickle.load("weights/random_forest_v1.pkl")
scaler = pickle.load("artifacts/standard_scaler.pkl")
freq_maps = json.load("artifacts/feature_columns.json")
```

Loading at module import time (not per-request) is intentional — it's expensive to load a model (~100ms), so you do it once when the server starts, then serve all requests from the in-memory copy.

#### Function: `preprocess_new_deal(raw_deals)`

Transforms raw deal dictionaries into the exact feature matrix the ML model expects:

```
Raw dict → Date engineering → Frequency encoding → Stage mapping → Scale → DataFrame
```

Key transformations:
- `Closing_Date` → `Close_Year`, `Close_Month`, `Close_Quarter`, `Deal_Age_Days`
- `Owner_Name` → `Owner_Freq` (how frequently this owner appears in training data)
- `Account_Name` → `Account_Freq` (same idea)
- All features scaled with the same StandardScaler fitted during training

**Critical:** The scaler was fitted on specific columns (stored in `feature_columns.json`). You must use the exact same columns at inference time — adding or removing a column breaks the model.

#### Function: `predict_batch(deals_df)`

Runs vectorized inference (all deals at once, not one at a time):
```python
predictions = rf_model.predict(deals_df)         # Class label for each deal
probabilities = rf_model.predict_proba(deals_df)  # Probability for each class

# "Won" is class index 3 in the model's training labels
base_probability = probabilities[i][3] * 100     # Convert to percentage
```

**Important note:** The current code multiplies by 100, storing probability as a percentage (e.g., 72.84). The recommendation controller then divides by 100 before sending to the LLM. This is a known inconsistency — future cleanup should standardize to 0.0–1.0 everywhere.

---

### 3.8 `controllers/ml_controller.py` — The ML Prediction Endpoint

**Responsibility:** Exposes two endpoints:
- `POST /api/v1/predict/deals` — single/batch prediction from a request body
- `POST /api/v1/jobs/run-predictions` — reads all deals from PostgreSQL, scores them, upserts results into `ml_predictions`

The batch job endpoint is what the automated pipeline calls. It:
1. Queries `zoho_deals` for all records
2. Runs `preprocess_new_deal()` + `predict_batch()` (vectorized — all deals processed simultaneously)
3. Upserts each result into `ml_predictions` using the same conflict-on-deal-id pattern

---

### 3.9 `models/ml_engine/data_fusion.py` — The Payload Assembler

**Responsibility:** The `fuse_deal_payload()` function merges data from two database tables into a single dictionary that becomes the LLM's input.

```python
# Input: MLPrediction ORM object (has deal_id, base_probability)
# Process: Fetches the matching ZohoDeal and combines relevant fields
# Output: One dictionary ready to send to the LLM

payload = {
    "deal_id": deal.id,
    "deal_name": deal.deal_name,
    "base_probability": 0.7284,          # From ml_predictions
    "stage": "Negotiation",              # From zoho_deals
    "amount": 48000.0,                   # From zoho_deals
    "days_to_close": 7,                  # Computed from closing_date
    "account_name": "TechFlow Inc.",     # From zoho_deals
    "owner_name": "Ahmed Hassan",        # From zoho_deals
    "custom_fields": {                   # From zoho_deals.custom_fields (JSONB)
        "Budget_Approved": "Yes",
        "Competitor_Present": "None",
        "Last_Contact_Days_Ago": 2
    },
    "feature_vector": {"amount_log": 10.3, "stage_encoded": 5}  # From ml_predictions
}
```

This is the **critical handoff point** in the pipeline. Everything upstream (Zoho, ML) feeds into this function. Everything downstream (LLM, database write) consumes its output.

---

### 3.10 `models/ai_agents/prompts.py` — The LLM Prompt Templates

**Responsibility:** Defines the system prompt, few-shot examples, and the `build_llm_prompt()` function that assembles the complete message array for the LLM API.

#### The System Prompt

Sets the LLM's persona and output schema:
```
You are an expert AI Sales Strategist...
Output ONLY valid JSON in this exact schema:
{
  "adjusted_probability": <float>,
  "recommendation_ar": "<Arabic text>",
  ...
}
```

The **output schema in the prompt** is what forces the LLM to return parseable JSON instead of free-form text. Combined with `response_format={"type": "json_object"}` in the API call, this gives two layers of JSON enforcement.

#### Few-Shot Examples

Four hand-crafted examples teach the LLM the pattern:

| Scenario | Base Prob | Adjustment | Reason |
|---|---|---|---|
| Budget approved, no competitor, negotiation stage | 0.82 | → 0.91 (+9pts) | Strong buying signals |
| Competitor present, no contact for 12 days | 0.65 | → 0.48 (-17pts) | High risk signals |
| 2 cancelled meetings, no budget | 0.38 | → 0.22 (-16pts) | Stalled deal |
| Existing customer, budget approved | 0.71 | → 0.78 (+7pts) | Expansion opportunity |

Few-shot examples are the most powerful form of LLM instruction. They show the model exactly what good output looks like, much more effectively than written rules.

#### `build_llm_prompt(deal_data)`

Constructs the messages array in the format the API expects:
```python
messages = [
    {"role": "system", "content": SYSTEM_PROMPT},
    # Few-shot example 1:
    {"role": "user", "content": "Deal Analysis Request: [example input]"},
    {"role": "assistant", "content": '{"adjusted_probability": 0.91, ...}'},
    # ... repeat for all 4 examples ...
    # The actual deal to analyze:
    {"role": "user", "content": "Deal Analysis Request: [real deal data]"},
]
```

The LLM sees this as a "conversation" where it has already answered similar questions perfectly. It then completes the pattern for the real deal.

---

### 3.11 `models/ai_agents/recommender.py` — The LLM Service

**Responsibility:** The `LLMRecommenderService` class manages all communication with the LLM API, including retry logic, response validation, and fallback handling.

#### `_call_llm_api(messages)` — The API Caller

Uses the `@retry` decorator from the `tenacity` library:
```python
@retry(
    stop=stop_after_attempt(3),           # Try at most 3 times
    wait=wait_exponential(min=2, max=10), # Wait 2s, then 4s, then 8s between retries
    retry=retry_if_exception_type((RateLimitError, APIError))  # Only retry on these errors
)
def _call_llm_api(self, messages):
    response = self.client.chat.completions.create(
        model=self.model_id,
        messages=messages,
        response_format={"type": "json_object"},  # Forces JSON output
    )
    return {"content": response.choices[0].message.content, "latency_ms": ...}
```

Exponential backoff is essential for production LLM usage. If Groq's API is temporarily overloaded (HTTP 429), retrying immediately just makes things worse. Waiting progressively longer gives the server time to recover.

#### `_parse_and_validate(raw_content)` — The Response Validator

Even with JSON mode enabled, LLMs occasionally wrap responses in markdown fences (` ```json ... ``` `). This method strips that, then validates the parsed object against the Pydantic schema:

```python
validated = LLMRecommendationOutput(**parsed)
# If adjusted_probability is 1.5 (invalid), Pydantic raises ValidationError
# If risk_flag is "UNKNOWN" (not in allowed list), the validator defaults it to "NONE"
```

#### `generate_recommendation(deal_data)` — The Main Entry Point

The orchestrator method:
1. Build messages → 2. Call API → 3. Parse & validate → 4. Package result with metadata → 5. Return

If **any** step fails after all retries, `_create_fallback_response()` is called. The fallback sets `adjusted_probability = base_probability` (no change) and a generic Arabic error message. This ensures the pipeline never crashes because of a single LLM failure — the deal just gets scored without an AI recommendation.

---

### 3.12 `controllers/recommendation_controller.py` — The Recommendation Endpoints

**Responsibility:** Exposes two endpoints:
- `POST /api/v1/recommendations/generate/{deal_id}` — generates a recommendation for one deal
- `POST /api/v1/recommendations/batch` — generates recommendations for all deals in a batch

**The batch endpoint uses `asyncio.gather`:**
```python
recommendations = await asyncio.gather(
    *[process_single(p) for p in predictions],
    return_exceptions=True  # Critical: isolate failures per deal
)
```

`asyncio.gather` with `return_exceptions=True` means if 3 out of 50 LLM calls fail, the other 47 succeed and are saved normally. Without `return_exceptions=True`, one failure would crash the entire batch.

---

### 3.13 `models/api_schemas.py` — The API Input/Output Schemas

**Responsibility:** Defines Pydantic models for request validation and response serialization. FastAPI uses these to automatically validate incoming request bodies and generate OpenAPI documentation.

---

### 3.14 `create_db.py` — The Table Creator

**Responsibility:** One-time setup script that reads all SQLAlchemy model definitions and creates the corresponding tables in PostgreSQL.

```python
Base.metadata.create_all(engine)
# This reads ZohoDeal, MLPrediction, LLMRecommendation class definitions
# and executes the equivalent CREATE TABLE ... SQL statements
```

Run this once when first setting up the database. After that, use Alembic migrations for schema changes.

---

### 3.15 `docker-compose.yaml` — The Infrastructure Definition

**Responsibility:** Defines the two infrastructure services needed to run the application:
- `db`: PostgreSQL 16 container, accessible on port 5433 (mapped from internal 5432)
- `pgadmin`: pgAdmin 4 web UI, accessible at `http://localhost:5050`

Data is persisted in a Docker volume (`pgdata`) so it survives container restarts.

---

## Part 4 — End-to-End Data Flow

This section traces the complete journey of a single sales deal through the entire system.

### Stage 0: System Startup

When you run `python app.py`:
```
app.py loads → Registers 3 routers → FastAPI starts on :8000
inference.py imports → Loads rf_model.pkl + scaler.pkl + feature_columns.json into RAM
```

### Stage 1: Zoho Data Pull (Every 30 Minutes)

**Triggered by:** `POST /api/v1/ingest/deals` (manually) or APScheduler (automated, Sprint 4)

```
ingestion_controller.py
    → calls get_new_access_token()           [zoho_api.py]
        → POST https://accounts.zoho.com/... → returns fresh access_token
    → calls fetch_deals_schema()             [zoho_api.py]
        → GET https://www.zohoapis.com/crm/v3/Deals
        → Zoho returns JSON array of deal objects
    → for each deal:
        → flatten nested JSON (Account_Name.name → account_name)
        → INSERT INTO zoho_deals ... ON CONFLICT DO UPDATE
    → db.commit()
```

**Output:** `zoho_deals` table populated/refreshed with latest deal data.

### Stage 2: ML Batch Scoring

**Triggered by:** `POST /api/v1/jobs/run-predictions`

```
ml_controller.py
    → db.query(ZohoDeal).all()              [reads zoho_deals table]
    → preprocess_new_deal(raw_deals)        [inference.py]
        → date features, frequency encoding, stage mapping, StandardScaler
        → returns DataFrame with exactly FEATURE_COLS columns
    → predict_batch(X_processed)            [inference.py]
        → rf_model.predict_proba(X) → probabilities
        → extracts class index 3 (Won) probability
        → returns [{predicted_stage_encoded, base_probability, confidence_all_classes}]
    → for each result:
        → INSERT INTO ml_predictions ... ON CONFLICT(deal_id) DO UPDATE
    → db.commit()
```

**Output:** `ml_predictions` table populated with `base_probability` scores.

### Stage 3: Data Fusion

**Triggered by:** Inside the recommendation batch job

```
data_fusion.py: fuse_deal_payload(db, prediction)
    → db.query(ZohoDeal).filter(id == prediction.deal_id).first()
    → combines:
        - base_probability (from ml_predictions)
        - stage, amount, closing_date, account_name, owner_name (from zoho_deals)
        - custom_fields JSONB (from zoho_deals) → qualitative LLM context
        - feature_vector (from ml_predictions) → SHAP display later
    → calculates days_to_close = (closing_date - today).days
    → returns one unified dict
```

**Output:** A single Python dictionary with everything the LLM needs.

### Stage 4: LLM Processing

**Triggered by:** `recommendation_controller.py` calling `llm_service.generate_recommendation(fused_payload)`

```
recommender.py: generate_recommendation(deal_data)
    → build_llm_prompt(deal_data)           [prompts.py]
        → constructs [system_msg, few_shot_1, few_shot_2, ..., actual_deal]
    → _call_llm_api(messages)
        → POST https://api.groq.com/openai/v1/chat/completions
        → with response_format: {type: "json_object"}
        → Groq/Llama returns: {"adjusted_probability": 0.89, "recommendation_ar": "..."}
    → _parse_and_validate(raw_content)
        → strip any markdown fences
        → json.loads()
        → LLMRecommendationOutput(**parsed) → Pydantic validation
    → packages result with metadata (latency_ms, model_id, prompt_version)
```

**Output:** Validated dict with `adjusted_probability`, `recommendation_ar`, `risk_flag`, etc.

### Stage 5: Database Write

```
recommendation_controller.py
    → INSERT INTO llm_recommendations:
        - deal_id, prediction_id (foreign keys)
        - llm_payload (full input — for debugging)
        - adjusted_probability (LLM output)
        - adjusted_score_pct, score_delta, priority_tier (computed by DB)
        - recommendation_ar, recommendation_en
        - risk_flag, risk_reasoning
        - llm_model_id, prompt_version, llm_latency_ms
    → ON CONFLICT (deal_id, batch_id) DO UPDATE
    → db.commit()
```

**Output:** `llm_recommendations` table has the final ranked data ready for the dashboard.

### Stage 6: Dashboard Display (Sprint 5 — React)

```
React Dashboard
    → GET /api/v1/deals/ranked
        → JOIN zoho_deals + llm_recommendations (latest per deal)
        → ORDER BY adjusted_probability DESC
    → renders ranked table with priority badges, dual progress bars, delta indicators
    → clicking a row:
        → GET /api/v1/deals/{deal_pk}
        → shows probability breakdown + Arabic recommendation + SHAP factors
    → rep clicks "Mark Actioned":
        → PATCH /api/v1/recommendations/{rec_pk}/action
        → writes rep_action_taken=TRUE to llm_recommendations
```

---

## Part 5 — Database Table Relationships

```
zoho_deals (1)
    │  deal_pk (PK)
    │
    └──→ ml_predictions (Many)
             │  prediction_pk (PK)
             │  deal_pk (FK → zoho_deals)
             │  unique(deal_id, batch_id)
             │
             └──→ llm_recommendations (1 per prediction)
                      │  recommendation_pk (PK)
                      │  prediction_pk (FK → ml_predictions)
                      │  deal_pk (FK → zoho_deals)
                      │
                      └── [READ by Dashboard]
```

**Cardinality:**
- One deal → many ML predictions (scored across multiple batch runs over time)
- One ML prediction → exactly one LLM recommendation
- Dashboard always reads the **latest** recommendation per deal via `ORDER BY generated_at DESC LIMIT 1`

---

## Part 6 — The Feedback Loop

The `rep_action_taken` boolean in `llm_recommendations` closes the loop:

```
LLM generates advice
    → Sales rep reads recommendation on dashboard
    → Rep clicks "Mark Actioned" (or "Dismiss")
        → PATCH /api/v1/recommendations/{rec_pk}/action
        → llm_recommendations.rep_action_taken = TRUE/FALSE
        → llm_recommendations.rep_feedback_at = NOW()
    → Future: Compare rep_action_taken=TRUE deals vs FALSE
    → Measure: Did "actioned" deals close at higher rates?
    → Iterate: Update few-shot examples in prompts.py if recommendations aren't being actioned
```

This feedback loop is what transforms a static ML system into a learning one over time.

---

## Part 7 — Error Handling Strategy

| Layer | Error Type | Handling Strategy |
|---|---|---|
| Zoho API | Auth failure | `get_new_access_token()` returns `None` → ingestion controller raises HTTP 401 |
| Zoho API | Network error | `requests.exceptions.RequestException` caught → HTTP 500 with message |
| ML inference | Missing features | `preprocess_new_deal` uses `.get()` with defaults; freq maps use `.get(key, 1)` for unseen values |
| LLM API | Rate limit (429) | `@retry` with exponential backoff — tries 3 times before giving up |
| LLM API | Bad JSON response | `_parse_and_validate` strips markdown, re-validates with Pydantic |
| LLM API | Persistent failure | `_create_fallback_response()` — sets adjusted_probability = base_probability, saves error string |
| Database | Duplicate insert | `ON CONFLICT DO UPDATE` — upsert pattern prevents all duplicate key errors |
| Batch job | Single LLM failure | `asyncio.gather(return_exceptions=True)` — isolates failure, continues other deals |

---

## Part 8 — Key Concepts Reference

### What is JSONB?
A PostgreSQL column type that stores JSON data in a binary format. Unlike TEXT, you can query inside it:
```sql
SELECT * FROM zoho_deals WHERE custom_fields->>'Budget_Approved' = 'Yes';
```
The GIN index on `custom_fields` makes these queries fast even with millions of rows.

### What is a Computed Column?
A database column whose value is automatically calculated from other columns. In PostgreSQL:
```sql
adjusted_score_pct NUMERIC GENERATED ALWAYS AS (ROUND(adjusted_probability * 100, 2)) STORED
```
You never insert into this column — the database fills it in. If `adjusted_probability` changes, `adjusted_score_pct` updates automatically.

### What is Few-Shot Prompting?
A technique where you give the LLM examples of input-output pairs before asking it to process new data. Each example "trains" the model in context without changing its weights. The more relevant your examples, the more consistent the outputs.

### What is Exponential Backoff?
When an API fails, waiting longer before each retry:
- Attempt 1 fails → wait 2 seconds
- Attempt 2 fails → wait 4 seconds
- Attempt 3 fails → wait 8 seconds → give up

This prevents overwhelming an already-struggling server with immediate retries.

### What is Vectorized Inference?
Processing all deals in one matrix operation instead of a loop:
```python
# Slow (loop):
for deal in deals:
    probability = model.predict_proba([deal])  # 50 separate calls

# Fast (vectorized):
probabilities = model.predict_proba(all_deals_matrix)  # 1 call for all 50
```
XGBoost is optimized for vectorized operations — this is 10–100x faster for large batches.

---

## Part 9 — Common Maintenance Tasks

### Add a New Custom Field to the LLM Prompt
1. In Zoho, add the field
2. In `controllers/ingestion_controller.py`, add it to `flattened_record` dict
3. In `models/schema.py`, the `custom_fields` JSONB column picks it up automatically — no schema change needed
4. In `models/ai_agents/prompts.py`, add examples showing how to interpret the new field
5. Bump `PROMPT_VERSION` from "v1.0" to "v1.1"

### Change the LLM Provider (e.g., switch from Groq to Claude)
1. Update `.env`: `LLM_BASE_URL=https://api.anthropic.com/v1`, `LLM_API_KEY=sk-ant-...`
2. Update `config.py`: Change `LLM_MODEL_ID` default
3. The `LLMRecommenderService` uses the OpenAI client format — this works with both Groq and Anthropic's APIs
4. Test: `POST /api/v1/recommendations/generate/{deal_id}`

### Retrain the ML Model
1. Run new EDA notebook with fresh data from `zoho_deals`
2. Fit new `StandardScaler` and save to `artifacts/standard_scaler.pkl`
3. Train new model, save to `weights/random_forest_v1.pkl` (or bump version)
4. Update `feature_columns.json` if feature list changed
5. Restart the server (model is loaded at startup)

---

## Part 10 — Sprint Completion Status

| Sprint | Theme | Status | Key Deliverable |
|---|---|---|---|
| **1** | Foundation & OAuth | ✅ Complete | Zoho OAuth, MVC structure, schema extraction |
| **2** | DB Build & Ingestion Pipeline | ✅ Complete | 3-table PostgreSQL schema, upsert pipeline |
| **3** | Feature Engineering & ML | ✅ Complete | Random Forest model, inference pipeline |
| **4** | LLM Integration | ✅ Complete | Groq/Llama recommendations, batch pipeline |
| **5** | React Dashboard | 🔄 In Progress | Ranked deal list, deal detail drawer |
| **6** | Hardening & Demo | ⏳ Pending | Logging, health checks, pitch deck |

---

*Document Version: 1.0 — Generated from full codebase analysis including AI_CRM_Brain_Roadmap_v2.1, SPRINT_4.md, System_Architecture_and_User_Scenario reference, and all source files.*
