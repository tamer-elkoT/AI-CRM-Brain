# AI CRM Brain — Complete Developer Technical Manual

> **Purpose:** This document is your ground truth for understanding the entire AI CRM Brain codebase — what every file does, how every button click flows through the system, and how to test everything in Postman. Read it once and you will know this system as well as the engineer who built it.

---

## Table of Contents

1. [The Big Picture — System Overview](#1-the-big-picture--system-overview)
2. [Directory & File Deep-Dive](#2-directory--file-deep-dive)
   - [Entry Point: `app.py`](#entry-point-apppy)
   - [Config Layer: `config.py` & `models/database.py`](#config-layer)
   - [Controllers Layer](#controllers-layer)
   - [Models Layer](#models-layer)
   - [Services Layer](#services-layer)
   - [Utils Layer](#utils-layer)
   - [Frontend Layer](#frontend-layer)
3. [UI-to-Backend Mapping — Button Click Anatomy](#3-ui-to-backend-mapping--button-click-anatomy)
   - [Sync Now](#31-sync-now)
   - [Generate AI Recommendations](#32-generate-ai-recommendations)
   - [Follow Up & Message Generation](#33-follow-up--message-generation)
4. [Visualizing the Architecture — Diagram Explanations](#4-visualizing-the-architecture--diagram-explanations)
5. [Postman Testing Guide](#5-postman-testing-guide)
6. [Key Concepts Explained Simply](#6-key-concepts-explained-simply)

---

## 1. The Big Picture — System Overview

AI CRM Brain sits between your **Zoho CRM** (the source of truth for raw deal data) and your **sales reps** (who need to know which deals to focus on). It does three things a standard CRM cannot do on its own:

1. **Predicts** the probability of each deal closing using a trained **Random Forest** ML model.
2. **Explains and refines** that prediction using a **Large Language Model (Groq/Grok)** that understands context your spreadsheet cannot — competitor mentions, deal stall signals, budget uncertainty.
3. **Acts** — notifies the right sales rep at the right time via in-app notifications and WhatsApp alerts.

### Technology Stack at a Glance

| Layer | Technology | Role |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite + TailwindCSS | Dashboard UI |
| API Server | FastAPI (Python) + Uvicorn | REST API Gateway |
| Database | PostgreSQL 16 (Docker) | Persistent Storage |
| ORM | SQLAlchemy 2 | Python ↔ DB bridge |
| ML Engine | Random Forest (scikit-learn) + StandardScaler | Win-probability prediction |
| LLM (Primary) | Groq API (`llama-3.3-70b-versatile`) | AI Recommendations |
| LLM (Fallback) | Grok API by xAI (`grok-3-latest`) | Client message generation |
| CRM Source | Zoho CRM v3 REST API | Raw deal & contact data |
| Messaging | Twilio WhatsApp Business API | Sales rep alerts |
| Auth | JWT (HS256) + bcrypt + OTP | User security |
| Background Jobs | APScheduler | Deferred follow-up checker |

---

## 2. Directory & File Deep-Dive

### Entry Point: `app.py`

**What it is:** The single file that boots the entire FastAPI application. Every time you run `python app.py` or `uvicorn app:app`, this file executes first.

**What it does (in order):**

1. **Creates the FastAPI app** with a title and version for the auto-generated Swagger docs (accessible at `http://localhost:8000/docs`).
2. **Registers CORS middleware** — this is the security gate that tells the browser "yes, it is okay for code on `localhost:5173` (the React dev server) to call `localhost:8000` (the FastAPI server)." Without this, the browser would block every API call.
3. **Mounts all 8 routers** under the `/api/v1` prefix. Each router is a controller file. Mounting them here is what makes the endpoints actually reachable via HTTP.
4. **Defines the `/health` endpoint** — a simple "are you alive?" check. Call `GET http://localhost:8000/health` in Postman to verify the server is running.
5. **Starts the APScheduler on startup** — registers a background job (`check_deferred_followups`) to run every 60 minutes. This is the automatic engine that fires WhatsApp alerts for overdue follow-ups even when no one is touching the UI.

```python
# Router mounting — the "address book" of the API
app.include_router(ingestion_controller.router, prefix="/api/v1", tags=["Ingestion"])
app.include_router(ml_controller.router,        prefix="/api/v1", tags=["ML Predictions"])
app.include_router(recommendation_controller.router, prefix="/api/v1", tags=["LLM Recommendations"])
app.include_router(dashboard_controller.router, prefix="/api/v1", tags=["Dashboard"])
app.include_router(action_controller.router,    prefix="/api/v1", tags=["Actions"])
app.include_router(auth_controller.router,      prefix="/api/v1/auth", tags=["Auth"])
app.include_router(followup_controller.router,  prefix="/api/v1", tags=["Follow-ups"])
app.include_router(notification_controller.router, prefix="/api/v1", tags=["Notifications"])
```

> **Note:** The `auth_controller` has a different prefix (`/api/v1/auth`). All auth endpoints live under `/api/v1/auth/login`, `/api/v1/auth/signup`, etc.

---

### Config Layer

#### `config.py` — The Settings Object

**What it is:** A Pydantic `BaseSettings` class that loads **all** environment variables from `.env` at startup and validates them. If a required variable (like `LLM_API_KEY`) is missing, the app crashes loudly at boot instead of silently failing mid-request.

**Why Pydantic settings?** You get automatic type coercion (strings → ints for `DB_PORT`), IDE autocomplete via `settings.LLM_API_KEY`, and a single place to add new config variables.

```python
from config import settings  # Used throughout the codebase
settings.LLM_API_KEY       # Your Groq API key
settings.GROK_BASE_URL     # "https://api.x.ai/v1"
settings.BATCH_INTERVAL_MINUTES  # 30 (default)
```

#### `models/database.py` — The Database Connection

**What it is:** Sets up the SQLAlchemy connection to PostgreSQL. This runs once when any file imports from it.

**Three things it creates:**
1. `engine` — the raw connection pool to PostgreSQL. Like a telephone exchange connecting Python to the database.
2. `SessionLocal` — a session factory. Every time you call `SessionLocal()`, you get a fresh database transaction context. Think of it as opening a database conversation.
3. `Base` — the declarative base class that all ORM models inherit from. When you run `Base.metadata.create_all(engine)`, SQLAlchemy reads every class that inherits from `Base` and creates the corresponding tables.

**Connection string pattern:**
```
postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@localhost:{DB_PORT}/{DB_NAME}
```

> **Important:** The `DB_PORT` is `5433` (not the default 5432) because Docker maps the container's internal 5432 to the host's 5433, preventing conflicts with any local PostgreSQL installation.

---

### Controllers Layer

Controllers are FastAPI **routers** — they own the HTTP endpoints. They receive the request, orchestrate calls to models/services, and return the HTTP response. They do not contain business logic.

#### `controllers/ingestion_controller.py` — Data Pipeline

**Endpoints:**
- `POST /api/v1/ingest/deals` — The "Sync Now" trigger
- `POST /api/v1/ingestion/upload` — Custom CSV/XLSX file upload

**`POST /ingest/deals` deep-dive:**

This endpoint is the backbone of the entire system. Here is exactly what happens, line by line:

1. **Opens a DB session manually** (`db = SessionLocal()`) — Note: This endpoint does NOT use FastAPI's `Depends(get_db)`. This is intentional because `ingest_zoho_deals()` is also called internally by `action_controller.py` without the HTTP request context. Manual session management is required here.

2. **Calls `fetch_deals_schema()`** from `models/data_ingestion/zoho_api.py`. This function:
   - Calls `get_new_access_token()` to exchange your permanent `ZOHO_REFRESH_TOKEN` for a fresh short-lived access token (tokens expire in 1 hour).
   - Makes `GET https://www.zohoapis.com/crm/v3/Deals` with the required fields.
   - Returns the raw array of deal JSON objects.

3. **Contact Enrichment** — Phone and email are NOT on the Deal object in Zoho. They live on the Contact object. The code collects every `Contact_Name.id` from the deals, then calls `fetch_contacts_by_ids()` to fetch each contact individually, building a `contacts_map = { contact_id: { phone, email } }`.

4. **Flattening** — For each deal, the nested JSON (e.g., `{ "Account_Name": { "id": "...", "name": "Acme" } }`) is flattened to `"account_name": "Acme"`. The `client_phone` and `client_email` are looked up from `contacts_map`.

5. **PostgreSQL UPSERT** — Uses `INSERT ... ON CONFLICT(id) DO UPDATE`. This means:
   - If a deal is new → INSERT
   - If a deal already exists → UPDATE all columns (including phone/email that may have been null on the first sync)
   - This is safe to call repeatedly without creating duplicates.

6. **Auto-classification** — After commit, calls `classify_all_deals(db)` from `services/deal_classifier.py`. This sets `action_status` on every deal based on their AI score.

---

#### `controllers/ml_controller.py` — Machine Learning Predictions

**Endpoints:**
- `POST /api/v1/predict/deals` — Inline prediction (accepts deal JSON in the request body)
- `POST /api/v1/jobs/run-predictions` — Batch prediction from the database

**`POST /jobs/run-predictions` deep-dive:**

1. **Queries all deals** from `zoho_deals` table.
2. **Converts SQLAlchemy ORM objects to plain dicts** — The ML functions expect Python dicts, not SQLAlchemy row objects.
3. **Calls `preprocess_new_deal(raw_deals)`** — See ML Engine section below.
4. **Calls `predict_batch(X_processed)`** — Returns prediction results.
5. **UPSERTs into `ml_predictions`** — Uses `ON CONFLICT(deal_id) DO UPDATE` so re-running predictions just refreshes the scores instead of creating duplicate rows.
6. **Generates a `batch_id`** (UUID4) to group predictions for traceability.

---

#### `controllers/recommendation_controller.py` — The AI Brain

**Endpoints:**
- `POST /api/v1/recommendations/generate/{deal_id}` — Single deal AI analysis
- `POST /api/v1/recommendations/generate` — **The main pipeline** (used by "Generate AI" button)
- `POST /api/v1/recommendations/batch` — Batch by a specific batch_id

**`POST /recommendations/generate` deep-dive (the full AI pipeline):**

This is the most complex endpoint in the system. It runs in two sequential phases:

**Phase 1 — Fill ML gaps:**
- Queries all deals that have NO entry in `ml_predictions` (using a LEFT JOIN + `WHERE ml_predictions.id IS NULL`).
- Runs the ML model on those deals.
- UPSERTs results into `ml_predictions`.

**Phase 2 — Generate LLM recommendations:**
- Queries all `MLPrediction` records that have NO matching `LLMRecommendation` (same LEFT JOIN pattern).
- For each prediction:
  1. **Fuses data** via `fuse_deal_payload(db, prediction)` — merges ML scores with CRM context (stage, amount, account, owner, custom fields, days to close).
  2. **Normalizes probability** — The ML model returns probability as a percentage (e.g., `92.84`). The LLM prompt needs it as a decimal (`0.9284`). Division by 100 happens here: `raw_prob / 100 if raw_prob > 1 else raw_prob`.
  3. **Calls the LLM** via `llm_service.generate_recommendation(fused_payload)`.
  4. **Saves to DB** with UPSERT.
  5. **Evaluates urgency** — If the deal meets the urgent criteria (high amount + low probability, OR high risk flag, OR very high probability), it adds background tasks to send WhatsApp alerts.

**Urgency criteria:**
```python
is_urgent = (
    (deal_amount >= 50000 and adj_prob < 0.45) or  # Big money at risk
    risk_flag in ("HIGH_RISK", "STALLED", "COMPETITOR_PRESENT") or  # Qualitative risk
    adj_prob > 0.85  # Hot lead ready to close
)
```

**Auto-classification** runs after all recommendations are saved.

---

#### `controllers/auth_controller.py` — User Authentication

**Endpoints:**
- `POST /api/v1/auth/login` — Email/password login → JWT
- `POST /api/v1/auth/signup` — Create account + send WhatsApp OTP
- `POST /api/v1/auth/verify-otp` — Verify OTP → JWT
- `POST /api/v1/auth/google` — Google OAuth login → JWT
- `GET /api/v1/auth/users/me` — Get current user profile (requires Bearer token)
- `PATCH /api/v1/auth/users/me/templates` — Save WhatsApp/email message templates

**The 2-step signup flow:**
1. `POST /signup` creates the user record with `is_whatsapp_verified=False`, generates a 6-digit OTP, saves it to the `otp_codes` table (with 10-minute expiry), and "sends" it via WhatsApp (currently logged to console in dev mode).
2. `POST /verify-otp` looks up the OTP by phone + code, checks it hasn't expired, sets `is_whatsapp_verified=True`, deletes the OTP record (consumed), and returns a JWT.

**`get_current_user_dep` — The Auth Guard:**
This is a FastAPI `Depends()` function used on protected endpoints. It:
1. Reads the `Authorization: Bearer <token>` header.
2. Decodes the JWT using `SECRET_KEY` and `ALGORITHM`.
3. Extracts the `sub` (subject) claim, which is the user's UUID.
4. Queries the `users` table for that UUID and returns the User ORM object.

If the token is missing, expired, or tampered, it returns `HTTP 401`.

---

#### `controllers/dashboard_controller.py` — Data for the UI

**Endpoints:**
- `GET /api/v1/deals` — Paginated deal list (used by Home pipeline table)
- `GET /api/v1/deals/ranked` — KPIs + scatter chart + ranked list (used by Dashboard page)
- `GET /api/v1/deals/{deal_id}` — Full deal detail (used by Right Drawer)
- `POST /api/v1/deals` — Create a deal manually
- `GET /api/v1/analytics/accounts/ranked` — Account performance chart
- `GET /api/v1/accounts/names` — Dropdown list for "Create Deal" modal
- `PATCH /api/v1/deals/{deal_id}/stage` — Inline stage editing

**The "latest recommendation" subquery pattern:**
A deal can have multiple recommendations (from different batch runs). The dashboard always shows only the LATEST recommendation per deal to prevent duplicate rows and stale data:

```python
# Subquery: find the most recent created_at per deal_id
latest_rec_subq = (
    db.query(LLMRecommendation.deal_id, func.max(LLMRecommendation.created_at))
    .group_by(LLMRecommendation.deal_id)
    .subquery()
)
# Then join to this subquery — gets exactly one rec per deal
```

**Score normalization in the dashboard:**
The ML model stores `base_probability` as a percentage float (e.g., `92.84`). The code defensively handles both formats:
```python
ml_score = round(ml_prob, 1) if ml_prob > 1 else round(ml_prob * 100, 1)
```

---

#### `controllers/followup_controller.py` — Follow-up Actions

**Endpoints:**
- `POST /api/v1/followups/schedule` — Evaluate all deals and create follow-up records
- `PATCH /api/v1/followups/{deal_id}/days` — Customize deferred follow-up period (1–90 days)
- `POST /api/v1/followups/{deal_id}/mark` — Record a completed follow-up
- `POST /api/v1/followups/{deal_id}/generate-message` — **Grok LLM message generation**
- `POST /api/v1/followups/{deal_id}/send-alert` — Send WhatsApp alert to rep

**`generate-message` deep-dive:**
This is the "Generate AI Message" / "Follow Up" button in the UI. It uses **Grok (xAI)** as the primary model (not Groq) because Grok excels at conversational tone:

1. Builds a detailed prompt with deal context (stage, amount, AI score, closing date).
2. Calls `settings.GROK_BASE_URL/chat/completions` with `settings.GROK_API_KEY`.
3. **If Grok fails** (API error, rate limit), automatically falls back to **Groq** (`settings.LLM_BASE_URL`).
4. Returns the generated message text ready to paste into WhatsApp.

The prompt explicitly forbids revealing internal data: *"Do NOT mention the AI score or internal data."*

---

#### `controllers/action_controller.py` — Bulk & Feedback Actions

**Endpoints:**
- `PATCH /api/v1/recommendations/{deal_id}/action` — Mark a recommendation as actioned by the rep
- `POST /api/v1/recommendations/{deal_id}/escalate` — Flag a deal for manager review
- `POST /api/v1/batch/trigger` — **Orchestrator**: runs Ingest → ML → LLM in sequence

The `/batch/trigger` endpoint is interesting because it directly calls the controller functions as Python functions, not as HTTP requests. This is an internal orchestration pattern — it bypasses the HTTP layer for internal chaining.

---

#### `controllers/notification_controller.py` — In-App Notifications

**Endpoints:**
- `GET /api/v1/notifications` — Paginated notification list (requires JWT)
- `GET /api/v1/notifications/unread-count` — Badge count for bell icon
- `PATCH /api/v1/notifications/read-all` — Dismiss all
- `PATCH /api/v1/notifications/{id}/read` — Dismiss one

All notification endpoints require authentication. The JWT is decoded inline (no `Depends()`) using `_get_user_id_from_token()`. Notifications are scoped to the authenticated user — you only ever see your own.

---

### Models Layer

#### `models/schema.py` — The Database Tables (ORM Models)

Every class here maps to a PostgreSQL table. SQLAlchemy reads these class definitions and creates the tables automatically.

**`User`** — (`users` table)
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `email` | String | Unique — login identifier |
| `hashed_password` | String | bcrypt hash; NULL for Google OAuth users |
| `name` | String | Display name |
| `role` | String | `"Sales"` or `"Client"` |
| `phone_number` | String | Country code format, e.g., `+201012345678` |
| `is_whatsapp_verified` | Boolean | True only after OTP verification |
| `whatsapp_template` | Text | Custom message template saved in Settings |
| `email_template` | Text | Custom email template saved in Settings |

**`ZohoDeal`** — (`zoho_deals` table)
| Column | Type | Notes |
|---|---|---|
| `id` | String | Zoho's numeric ID stored as string (e.g., "6917488000000451005") |
| `deal_name` | String | Deal title |
| `stage` | String | Pipeline stage (7 possible values) |
| `amount` | Float | Deal value in USD |
| `closing_date` | DateTime | Expected close date |
| `account_name` | String | Company name |
| `zoho_probability` | Float | Zoho's built-in probability (NOT used by ML) |
| `client_phone` | String | Populated from Zoho Contacts enrichment |
| `client_email` | String | Populated from Zoho Contacts enrichment |
| `custom_fields` | JSONB | Raw Zoho custom fields (passed to LLM) |
| `action_status` | String | `need_action_now`, `need_action_3days`, `followed_up`, `no_action` |
| `followup_days_override` | Integer | Customizable deferred follow-up period (default: 3 days) |

**`MLPrediction`** — (`ml_predictions` table)
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `deal_id` | String | FK → `zoho_deals.id`, **UNIQUE** (only one prediction per deal) |
| `batch_id` | UUID | Groups predictions from the same run |
| `predicted_stage_encoded` | Integer | ML class: 0=Lost, 1=Engaging, 2=Prospecting, 3=Won |
| `base_probability` | Float | P(Won) from the Random Forest, stored as % (e.g., 92.84) |
| `confidence_all_classes` | JSONB | Array of 4 probabilities for all classes |
| `feature_vector` | JSONB | The scaled input features (for SHAP analysis) |

**`LLMRecommendation`** — (`llm_recommendations` table)

This is the richest table. It stores the LLM's full context, output, and metadata for every recommendation.

| Column | Type | Notes |
|---|---|---|
| `deal_id` + `batch_id` | UniqueConstraint | Prevents duplicate recs per deal per batch |
| `llm_payload` | JSONB | Exact input sent to the LLM (critical for debugging hallucinations) |
| `adjusted_probability` | Float | LLM's revised win probability (decimal, e.g., 0.87) |
| `adjusted_score_pct` | Float | **Computed column**: `adjusted_probability * 100`, auto-calculated by PostgreSQL |
| `score_delta` | Float | **Computed column**: `(adjusted_probability - base_probability) * 100` — how much the LLM changed the score |
| `priority_tier` | String | **Computed column**: `HIGH` if ≥75%, `MEDIUM` if ≥45%, else `LOW` |
| `recommendation_ar` | Text | Arabic "Next Best Action" from the LLM |
| `recommendation_en` | Text | English translation |
| `risk_flag` | String | `HIGH_RISK`, `COMPETITOR_PRESENT`, `STALLED`, `BUDGET_UNCERTAIN`, or `NONE` |
| `llm_model_id` | String | Records which model generated this (audit trail) |
| `prompt_version` | String | Records prompt version (currently `v1.0`) |
| `llm_latency_ms` | Integer | API call time in milliseconds |
| `rep_action_taken` | Boolean | True when sales rep clicks "Mark Actioned" |

> **Computed columns** are calculated and stored automatically by PostgreSQL — no Python code needed. They always stay in sync with their source columns.

**`DealFollowup`** — (`deal_followups` table)
Stores the *schedule* for when a follow-up should happen. `urgency` is either `"immediate"` (score ≥ 90%) or `"deferred"`. `notified_at` is NULL until the background scheduler fires.

**`FollowupLog`** — (`followup_logs` table)
Records each *completed* follow-up action (channel used, message sent, notes). The `followup_count` shown in the UI is the COUNT of rows in this table per deal.

**`Notification`** — (`notifications` table)
In-app notification records. Created by `classify_all_deals()` and `followup_scheduler.py`. Users only see their own; `is_read` drives the unread badge count.

---

#### `models/api_schemas.py` — API Contracts (Pydantic Models)

These are the data shapes that FastAPI uses to **validate request bodies** and **serialize response JSON**. They act as contracts between the frontend and backend.

Key schemas:
- `ZohoDealResponse` / `DealPredictionResponse` — used in the raw ML prediction endpoint
- `RankedDeal` — the shape of each row in the deals table (has `ml_score`, `ai_score`, `action_status`, `followup_count`)
- `DealDetailResponse` — the full detail for the right drawer (includes `recommendation_ar`, `feature_vector`, `risk_flag`)
- `RecommendationResponse` — response from single-deal recommendation generation
- `UserCreate` / `LoginRequest` / `TokenResponse` — auth flow schemas
- `GenerateMessageResponse` — response from Grok message generation

---

#### `models/ml_engine/inference.py` — ML Model in Production

**What it is:** The module that loads the trained Random Forest model and runs it on new deals at inference time.

**Startup behavior (critical):** When this module is first imported, three files are loaded into memory:
1. `weights/random_forest_v1.pkl` — the serialized scikit-learn RandomForestClassifier
2. `artifacts/standard_scaler.pkl` — the StandardScaler fitted during training
3. `artifacts/feature_columns.json` — the exact list of feature column names + frequency encoding maps

These stay in memory for the lifetime of the process. This is why inference is fast — no disk reads on every request.

**`preprocess_new_deal(raw_deals: list[dict]) -> pd.DataFrame`**

This function transforms raw deal dicts into the exact scaled feature matrix the model expects. It must reproduce the same transformations done during training, or the model will produce garbage:

1. **Date engineering** — Extracts `Close_Year`, `Close_Month`, `Close_Quarter`, `Close_DayOfWeek`, `Deal_Age_Days` from `Closing_Date`.
2. **Frequency encoding** — Replaces categorical strings like `"Owner_Name": "Ahmed Hassan"` with how frequently that owner appears in the training data (`Owner_Freq`). Unseen owners get a default of `1`.
3. **Stage mapping** — Maps Zoho stage names to the 4-class ML taxonomy:
   - `Qualification` / `Needs Analysis` → `Prospecting`
   - `Value Proposition` / `Proposal` / `Negotiation` → `Engaging`
   - `Closed Won` → `Won`
   - `Closed Lost` → `Lost`
4. **Column selection + scaling** — Selects exactly the columns in `FEATURE_COLS` and applies `scaler.transform()` (StandardScaler normalizes features to mean=0, std=1).

**`predict_batch(deals_df: pd.DataFrame) -> list[dict]`**

Runs vectorized inference on the processed DataFrame:
- `rf_model.predict()` → returns the class with highest probability (0, 1, 2, or 3)
- `rf_model.predict_proba()` → returns all 4 class probabilities
- `WON_CLASS_INDEX = 3` — the "Won" class is at index 3 based on training
- `base_probability` is stored as a **percentage** (multiplied by 100)

---

#### `models/ml_engine/data_fusion.py` — Context Assembly

**`fuse_deal_payload(db, prediction) -> dict`**

Takes an `MLPrediction` object, fetches its parent `ZohoDeal` from the DB, and assembles the complete payload that gets sent to the LLM. This is what gives the LLM its context:

```python
payload = {
    "deal_id": deal.id,
    "deal_name": deal.deal_name,
    "base_probability": 0.9284,    # ML model output (normalized to decimal)
    "stage": "Negotiation/Review",
    "amount": 48000.0,
    "days_to_close": 7,            # Calculated: closing_date - today
    "account_name": "Acme Corp",
    "owner_name": "Ahmed Hassan",
    "custom_fields": { "Budget_Approved": "Yes", "Competitor_Present": "None" },
    "feature_vector": { ... }      # Scaled features for SHAP analysis
}
```

---

#### `models/ai_agents/recommender.py` — The LLM Service

**`LLMRecommenderService` class:**

This is a service class that wraps the LLM API with reliability features. It is instantiated once at module load time (`llm_service = create_recommender_service()`) and reused for all requests.

**`_call_llm_api()` — with retry logic:**
Uses the `tenacity` library to automatically retry on `RateLimitError` or `APIError`:
- Retries up to **3 times**
- Waits **2→4→8 seconds** between retries (exponential backoff)
- Forces `response_format={"type": "json_object"}` — tells Groq to always return valid JSON, not markdown prose

**`_parse_and_validate()` — LLM output validation:**
Even with JSON mode, LLMs sometimes wrap responses in markdown (` ```json ... ``` `). This function:
1. Strips the markdown code fences if present
2. Parses the JSON string into a Python dict
3. Validates the dict against the `LLMRecommendationOutput` Pydantic model
4. Rejects any `risk_flag` not in the allowed list (defaults to `"NONE"`)

**`_create_fallback_response()` — graceful degradation:**
If the LLM completely fails (all 3 retries exhausted), the system does NOT crash. Instead, it returns the base ML probability unchanged with an Arabic/English error message. The deal still gets saved to the DB with a usable score.

---

#### `models/ai_agents/prompts.py` — LLM Prompt Engineering

**`SYSTEM_PROMPT`** — Sets the LLM's persona and task. It is an "expert AI Sales Strategist for Arabic-speaking markets" that must output structured JSON with exactly 5 fields.

**`FEW_SHOT_EXAMPLES`** — 4 input/output pairs that teach the LLM how to behave:
- A high-probability deal with no competitors → probability increases, NONE risk flag
- A stalled deal with a competitor → probability drops significantly, COMPETITOR_PRESENT flag
- A dead-end deal with cancelled meetings → probability drops drastically, STALLED flag
- An existing customer expansion → probability increases modestly, NONE flag

Few-shot prompting is critical here — without these examples, the LLM produces inconsistent JSON structure and unreliable probability adjustments.

**`build_llm_prompt(deal_data) -> list[dict]`**
Assembles the full messages array for the chat API. It follows the pattern:
```
[System message]
[User: Example 1] [Assistant: Example 1 output]
[User: Example 2] [Assistant: Example 2 output]
...
[User: The actual deal to analyze]
```

---

#### `models/data_ingestion/zoho_api.py` — Zoho CRM Client

**`get_new_access_token()`** — OAuth token refresh. Uses the permanent `ZOHO_REFRESH_TOKEN` stored in `.env` to get a fresh short-lived access token (valid for 1 hour). Every sync call triggers this.

**`fetch_deals_schema()`** — Fetches all deals from Zoho CRM v3 API. The fields requested are: `Deal_Name, Amount, Stage, Closing_Date, Probability, Expected_Revenue, Account_Name, Contact_Name, Owner`. Note: `Phone` and `Email` are deliberately excluded here because they don't exist on the Deals module.

**`fetch_contacts_by_ids(contact_ids)`** — Fetches contacts one by one from the Zoho Contacts API to get phone and email. This is a limitation — Zoho does not offer a bulk contact fetch by ID in the free tier. For large datasets, this should be replaced with the COQL batch endpoint.

---

### Services Layer

#### `services/deal_classifier.py` — The Deal Scoring Engine

**`classify_all_deals(db) -> dict`**

This is called automatically after every sync AND after every AI generation run. It is the system's "re-index" operation. It:

1. Queries all active deals (excluding `Closed Won` and `Closed Lost`) with their latest recommendation.
2. For each deal with a recommendation:
   - **Score ≥ 90%**: Sets `action_status = "need_action_now"`, creates an immediate `DealFollowup`.
   - **Score < 90%**: Sets `action_status = "need_action_3days"`, creates a deferred `DealFollowup` scheduled for `now + followup_days_override` days.
3. **Only if status changed**, creates an in-app `Notification` for the deal owner (with 🔴 or 🟡 emoji based on urgency).
4. **For immediate deals only**, calls `_log_whatsapp_alert()` which calls `send_headless_whatsapp()` via Twilio.

**Dev fallback for notifications:** If no user matches the deal's `owner_name`, the notification is given to the first user in the database. This ensures notifications always appear in the UI during development even if owner names don't exactly match user names.

---

#### `services/followup_scheduler.py` — The Background Alarm Clock

**`check_deferred_followups()`** — Called every 60 minutes by APScheduler. Finds all `DealFollowup` records where:
- `urgency = "deferred"` (not immediate)
- `scheduled_at <= NOW()` (the wait period has ended)
- `notified_at IS NULL` (not yet sent)

For each due follow-up:
1. Updates the deal's `action_status` to `"need_action_now"` (escalates urgency)
2. Creates an in-app notification for the owner
3. Attempts to send a WhatsApp alert via `send_headless_whatsapp()`
4. Sets `notified_at = NOW()` to prevent re-sending

---

#### `services/notification_service.py` — WhatsApp Alert Logic

**`evaluate_and_notify()`** — The business logic gate for WhatsApp alerts. Only fires if the deal meets strict criteria:
- `RISK`: amount ≥ $50,000 AND probability < 45%, OR risk_flag indicates serious problems
- `HOT_LEAD`: probability > 85%

**`send_whatsapp_otp()`** — Sends the 6-digit signup OTP. Currently **mocked** — logs to console. Uncomment the Twilio block to make it real.

**`send_whatsapp_alert()`** — Formats and sends deal alerts. Routes through `utils/whatsapp_sender.py`.

---

### Utils Layer

#### `utils/security.py` — JWT & Password Hashing

**`create_access_token(data, expires_delta)`** — Creates a signed JWT. The token payload contains:
- `sub`: the user's UUID (the "subject" — who this token is for)
- `exp`: expiry timestamp (default: 7 days = 10,080 minutes)

**`verify_password(plain, hashed)`** — Uses `bcrypt.checkpw()` to compare a plain-text password against its stored bcrypt hash. bcrypt is intentionally slow, making brute-force attacks impractical.

**`get_password_hash(password)`** — Creates a bcrypt hash with a random salt. The salt is embedded in the hash string, so you never need to store it separately.

#### `utils/whatsapp_sender.py` — Twilio Integration

**`send_headless_whatsapp(phone, message) -> bool`** — Sends a WhatsApp message via the Twilio API. Key behaviors:
- Requires `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER` in `.env`
- Auto-formats Egyptian numbers: `01012345678` → `+201012345678`
- Returns `True` on success, `False` on any failure (non-crashing)

---

### Frontend Layer

**Tech stack:** React 18 + TypeScript + Vite + TailwindCSS + React Query (TanStack Query) + Axios

#### Architecture: How React Talks to the Backend

```
React Component
    ↓ calls
Custom Hook (useDeals.ts)
    ↓ calls
API service function (api.ts)
    ↓ makes HTTP call via
Axios instance (with JWT interceptor)
    ↓ hits
FastAPI backend
```

**`frontend/src/services/api.ts`** — The single Axios instance. Critically, it registers a **request interceptor** that automatically injects the JWT from `localStorage` into every outgoing request:

```typescript
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

This means once you log in, you never need to manually add auth headers — it happens automatically on every call.

**`frontend/src/hooks/useDeals.ts`** — React Query hooks. These manage server state (caching, refetching, loading/error states) for all API calls. Key behaviors:
- `useQuery` hooks: fetch data and cache it. Components get instant data from cache while a background refetch happens.
- `useMutation` hooks: trigger state-changing calls (POST/PATCH). After success, they call `queryClient.invalidateQueries()` to force all affected queries to refetch fresh data from the server.

**`frontend/src/App.tsx`** — React Router configuration. Routes are:
- `/auth` — Login/Signup page (public)
- `/onboarding` — Post-signup onboarding (protected)
- `/home` — Pipeline table (protected)
- `/dashboard` — KPI + chart view (protected)
- `/integrations` — CRM connection management (protected)
- `/settings` — User profile + templates (protected)

`ProtectedRoute` is a wrapper that checks for a valid token in localStorage. If none exists, it redirects to `/auth`.

**Key Components:**

| Component | File | Purpose |
|---|---|---|
| `DealDrawer` | `components/DealDrawer.tsx` | Right-side slide panel with full deal details, probability bars, Arabic AI recommendation, Quick Actions |
| `MessageGeneratorModal` | `components/MessageGeneratorModal.tsx` | Modal that calls Grok to generate WhatsApp message for the client |
| `OutreachModal` | `components/OutreachModal.tsx` | Opens WhatsApp/email client with pre-filled message |
| `NotificationBell` | `components/NotificationBell.tsx` | Bell icon with unread count badge; polls every 60s |
| `CreateDealModal` | `components/CreateDealModal.tsx` | Form to manually create a deal (bypassing Zoho sync) |
| `AppLayout` | `components/AppLayout.tsx` | Shared sidebar + top nav layout for all protected pages |

---

## 3. UI-to-Backend Mapping — Button Click Anatomy

### 3.1 Sync Now

**Trigger:** User clicks the **"Sync & Refresh"** button on the Home page (or "Re-Sync Data" on the Integrations page).

**Step-by-step journey:**

```
1. [React] Home.tsx: handleSync() is called
   └─ Calls syncMutation.mutate()
   └─ syncMutation is useTriggerSync() from useDeals.ts

2. [React Hook] useTriggerSync (useDeals.ts)
   └─ mutationFn: actionApi.triggerSync()
   └─ actionApi.triggerSync calls:

3. [Axios] POST http://localhost:8000/api/v1/ingest/deals
   (JWT auto-injected by interceptor in api.ts)

4. [FastAPI Router] app.py routes to:
   ingestion_controller.ingest_zoho_deals()

5. [Controller] ingestion_controller.py:
   a. Opens DB session (SessionLocal())
   b. Calls zoho_api.fetch_deals_schema()
      └─ get_new_access_token(): POST to Zoho OAuth → gets access_token
      └─ GET https://www.zohoapis.com/crm/v3/Deals → raw deal array
   c. Collects contact IDs from deals
   d. Calls fetch_contacts_by_ids(contact_ids)
      └─ GET https://www.zohoapis.com/crm/v3/Contacts/{id} (per contact)
      └─ Returns {contact_id: {phone, email}} map
   e. For each deal:
      └─ Flattens nested JSON to flat dict
      └─ Looks up client_phone/email from contacts_map
      └─ INSERT INTO zoho_deals ... ON CONFLICT(id) DO UPDATE
   f. db.commit()
   g. Calls classify_all_deals(db)
      └─ Sets action_status on every active deal
      └─ Creates DealFollowup records
      └─ Creates Notification records for owners

6. [Response] Returns:
   { status, message, source, classification }

7. [React Hook] onSuccess:
   └─ queryClient.invalidateQueries(['dashboard'])
   └─ queryClient.invalidateQueries(['all_deals'])
   └─ queryClient.invalidateQueries(['account_ranking'])
   (All these queries refetch silently in the background)

8. [Toast notification] "🔄 Sync Complete: Pipeline successfully automated. Synced N deals."

9. [React] Table automatically re-renders with fresh data from cache
```

---

### 3.2 Generate AI Recommendations

**Trigger:** User clicks **"Generate AI"** button on the Home page.

```
1. [React] Home.tsx: handleGenerateAI() is called
   └─ Calls generateMutation.mutate()
   └─ generateMutation is useGenerateRecommendations()

2. [Axios] POST http://localhost:8000/api/v1/recommendations/generate

3. [FastAPI] recommendation_controller.generate_all_recommendations()

4. ── PHASE 1: Fill ML Gaps ──
   a. Query: SELECT zoho_deals LEFT JOIN ml_predictions WHERE ml_predictions.id IS NULL
      (Finds all deals without ML scores)
   b. For each deal without a score:
      └─ Build raw dict: {Deal_ID, Amount, Closing_Date, Stage, Owner_Name, Account_Name}
   c. X_processed = preprocess_new_deal(raw_deals)
      └─ Date feature engineering (Year, Month, Quarter, DayOfWeek, Age_Days)
      └─ Frequency encode Owner_Name and Account_Name
      └─ Select exactly FEATURE_COLS columns
      └─ scaler.transform() → normalized feature matrix
   d. ml_results = predict_batch(X_processed)
      └─ rf_model.predict() → class labels (0,1,2,3)
      └─ rf_model.predict_proba() → probability arrays
      └─ base_probability = probabilities[i][3] * 100  (class 3 = Won, stored as %)
   e. INSERT INTO ml_predictions ... ON CONFLICT(deal_id) DO UPDATE
   f. db.commit()

5. ── PHASE 2: Generate LLM Recommendations ──
   a. Query: SELECT ml_predictions LEFT JOIN llm_recommendations WHERE llm_recommendations.id IS NULL
      (Finds all predictions without LLM analysis)
   b. For each prediction:
      └─ fuse_deal_payload(db, prediction)
          └─ Fetches deal from DB
          └─ Calculates days_to_close
          └─ Assembles full context dict
      └─ Normalizes base_probability: divide by 100 if > 1
      └─ messages = build_llm_prompt(fused_payload)
          └─ SYSTEM_PROMPT (sets LLM persona + JSON schema)
          └─ 4 few-shot examples (input/output pairs)
          └─ Actual deal as the final user message
      └─ LLM API call (Groq) with response_format=json_object
          └─ Retries up to 3x on RateLimitError/APIError
      └─ _parse_and_validate(raw_content)
          └─ Strip markdown if present
          └─ json.loads()
          └─ Pydantic validation (adjusted_probability, risk_flag, etc.)
      └─ INSERT INTO llm_recommendations ... ON CONFLICT(deal_id, batch_id) DO UPDATE

   c. Evaluate urgency:
      └─ If (amount >= 50k AND prob < 0.45) OR risk_flag in danger list OR prob > 0.85:
          └─ background_tasks.add_task(evaluate_and_notify, ...)  ← fires AFTER response
          └─ background_tasks.add_task(notify_sales_manager, ...)

6. ── AUTO-CLASSIFY ──
   Calls classify_all_deals(SessionLocal()) on a fresh session

7. [Response] Returns:
   {
     "status": "success",
     "ml_predictions_generated": N,
     "recommendations_generated": M,
     "urgent_deals_flagged": K,
     "batch_id": "uuid"
   }

8. [React] Toast notification + all queries invalidated → table refreshes
   "🧠 AI Analysis Complete: M recommendations generated. K urgent deals flagged."

9. [Background Tasks] WhatsApp alerts sent to sales reps for urgent/hot deals
```

---

### 3.3 Follow Up & Message Generation

**Trigger A:** User clicks the **✓ (check circle)** button in the table row or "Mark Followed Up" in the Drawer footer.

```
1. [React] handleMarkFollowedUp(e, deal)
   └─ markFollowedUp.mutate({ dealId, data: { channel: 'manual', notes: '...' } })

2. [Axios] POST /api/v1/followups/{deal_id}/mark
   Body: { "channel": "manual", "notes": "Marked from pipeline table" }

3. [Controller] followup_controller.mark_followed_up()
   a. Fetch deal from DB
   b. INSERT INTO followup_logs (deal_id, channel, message_sent, notes)
   c. UPDATE zoho_deals SET action_status = "followed_up"
   d. UPDATE deal_followups SET notified_at = NOW()
      (Marks pending follow-ups as completed)
   e. Creates Notification for the owner: "Followed Up: {deal_name}"
   f. db.commit()

4. [Response] { status, message, followup_count, followed_up_at }

5. [React] Toast "✅ Followed Up" + queries invalidated
   Table row's Action column changes to "✅ Followed Up" badge
```

**Trigger B:** User clicks the ✨ **"Generate AI Message"** button (wand icon in table or Drawer).

```
1. [React] setMessageGenDeal(deal) → opens MessageGeneratorModal

2. Inside modal, user (optionally) adjusts sales rep name, then clicks "Generate"
   └─ useGenerateMessage().mutate({ dealId, salesRepName })

3. [Axios] POST /api/v1/followups/{deal_id}/generate-message
   Body: { "sales_rep_name": "Ahmed Hassan" }

4. [Controller] followup_controller.generate_client_message()
   a. Fetch deal from DB
   b. Fetch latest LLMRecommendation for AI score
   c. Build Grok prompt:
      - Context: deal name, account, stage, amount, AI score, closing date
      - Rules: under 120 words, professional tone, call-to-action, NO internal data
   d. POST to settings.GROK_BASE_URL/chat/completions
      - model: settings.GROK_MODEL ("grok-3-latest")
      - If Grok fails → fallback to Groq API automatically

5. [Response] { status, generated_message, deal_name, account_name, client_phone }

6. [React] Modal displays the generated message
   User can copy it or click "Open WhatsApp" → opens wa.me link in new tab
```

---

## 4. Visualizing the Architecture — Diagram Explanations

The three diagrams in `dashboard/user_scenario/` are teaching tools. Here is what each one is meant to convey:

### `system_architecture.svg`

**What it teaches:** The **technology boundaries and data direction** of the entire system.

This is the "30,000 foot view." It shows three distinct zones:
1. **External Systems** (Zoho CRM, Groq/Grok LLM APIs) — third-party services that the backend calls.
2. **Backend Core** (FastAPI + PostgreSQL) — where all business logic and persistence lives.
3. **Frontend** (React Dashboard) — what the user sees and interacts with.

The arrows show **data flow direction**: Zoho → Backend (ingest), Backend → LLM (analyze), LLM → Backend (store), Backend → React (display). This diagram answers the question: "What calls what, and in which direction?"

**Key insight for developers:** The frontend NEVER directly calls Zoho or the LLM. All external API calls go through the FastAPI backend. The React app only talks to `localhost:8000`.

### `user_flow.svg`

**What it teaches:** The **user's journey** through the product, mapped as a state machine.

This diagram follows a single sales rep from login to taking action on a deal. It shows every screen transition, every decision point (authenticated? verified? has ML score?), and every success/failure state.

**Key insight for developers:** It makes the **"happy path"** explicit — Login → Onboarding → See Deals → Sync → Generate AI → Follow Up. It also shows the branching paths (Google vs Email login, OTP success vs failure) that you need to handle in your code.

### `mvc_interaction.svg`

**What it teaches:** The **internal component communication pattern** — specifically the MVC (Model-View-Controller) layering.

This diagram zooms inside the FastAPI backend and shows the strict one-way dependency chain:

```
React (View) → Controller → Service/ML Engine → ORM Model → PostgreSQL
```

It visualizes why the codebase is organized the way it is: Controllers never talk to PostgreSQL directly (they go through ORM models). React never calls the ML engine directly (it goes through an API endpoint). This separation means you can swap any layer independently — change the ML model without touching the React code, change the database without touching the controller logic.

**Key insight for developers:** When you add a new feature, this diagram tells you exactly which layer to modify. New UI interaction? Touch the Controller and React. New business rule? Touch the Service. New data? Touch the Schema and run a migration.

---

## 5. Postman Testing Guide

### Prerequisites

1. Start the backend: `python app.py` (or `uvicorn app:app --reload`)
2. Start the frontend (optional for API testing): `cd frontend && npm run dev`
3. Database is running: `docker-compose up -d`
4. Set Postman base URL: `http://localhost:8000`
5. Open the auto-generated API docs at: `http://localhost:8000/docs`

### Collection Setup: Bearer Token Variable

1. Create a Postman Collection named "AI CRM Brain"
2. Go to **Collection → Variables** and add `token` (value: empty for now)
3. Set all authenticated requests to use: **Auth → Bearer Token → `{{token}}`**

---

### Step 1: Health Check

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:8000/health` |
| **Auth** | None |

**Expected Response:**
```json
{
  "status": "online",
  "timestamp": "2026-06-05"
}
```

---

### Step 2: Create a Test Account

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:8000/api/v1/auth/signup` |
| **Auth** | None |
| **Headers** | `Content-Type: application/json` |

**Request Body:**
```json
{
  "email": "test@example.com",
  "password": "SecurePassword123",
  "name": "Test Developer",
  "role": "Sales",
  "phone_number": "+201234567890"
}
```

**Expected Response (201):**
```json
{
  "status": "pending_verification",
  "message": "Account created. Please verify your WhatsApp number with the OTP code.",
  "phone_number": "+201234567890"
}
```

> **Dev shortcut:** Check the FastAPI console for the OTP code — it is printed in a box in the server logs.

---

### Step 3: Verify OTP & Get JWT

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:8000/api/v1/auth/verify-otp` |
| **Auth** | None |

**Request Body:**
```json
{
  "phone_number": "+201234567890",
  "otp_code": "123456"
}
```

**Expected Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

> **Action:** Copy the `access_token` value into the Collection's `token` variable.

---

### Step 4: Verify Token — Get Current User

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:8000/api/v1/auth/users/me` |
| **Auth** | Bearer Token `{{token}}` |

**Expected Response (200):**
```json
{
  "id": "uuid-of-user",
  "email": "test@example.com",
  "name": "Test Developer",
  "is_active": true,
  "role": "Sales",
  "is_whatsapp_verified": true
}
```

---

### Step 5: Sync Deals from Zoho

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:8000/api/v1/ingest/deals` |
| **Auth** | Bearer Token `{{token}}` (optional — this endpoint doesn't enforce auth) |

**Expected Response (200):**
```json
{
  "status": "success",
  "message": "Pipeline successfully automated. Synced 24 deals to PostgreSQL.",
  "source": "Zoho CRM REST API v3",
  "classification": {
    "classified": 24,
    "immediate": 5,
    "deferred": 19,
    "notifications_created": 24,
    "whatsapp_alerts": 5
  }
}
```

---

### Step 6: Run ML Predictions

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:8000/api/v1/jobs/run-predictions` |
| **Auth** | Bearer Token `{{token}}` |

**Expected Response (200):**
```json
{
  "status": "success",
  "message": "Successfully predicted and stored 24 deals.",
  "sample_prediction": {
    "predicted_stage_encoded": 3,
    "base_probability": 87.42,
    "confidence_all_classes": [0.04, 0.05, 0.04, 0.87]
  }
}
```

> **Note:** `predicted_stage_encoded: 3` = "Won" class. `base_probability: 87.42` means 87.42% chance of winning.

---

### Step 7: Test the ML Model in Isolation

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:8000/api/v1/predict/deals` |
| **Auth** | Bearer Token `{{token}}` |

**Request Body:**
```json
[
  {
    "Deal_ID": "TEST-001",
    "Amount": 75000.0,
    "Closing_Date": "2026-12-31",
    "Owner_Name": "Ahmed Hassan",
    "Account_Name": "Acme Corp",
    "Stage": "Negotiation/Review"
  }
]
```

**Expected Response (200):**
```json
[
  {
    "Deal_ID": "TEST-001",
    "predicted_stage_encoded": 3,
    "base_probability": 91.23,
    "confidence_all_classes": [0.01, 0.03, 0.05, 0.91]
  }
]
```

This endpoint is completely isolated from the database. Use it to test the ML model with any deal data without touching PostgreSQL.

---

### Step 8: Generate AI Recommendations (Full Pipeline)

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:8000/api/v1/recommendations/generate` |
| **Auth** | Bearer Token `{{token}}` |
| **Note** | This call takes 10–60 seconds depending on deal count and LLM latency |

**Expected Response (200):**
```json
{
  "status": "success",
  "message": "AI pipeline complete. 0 ML predictions + 24 LLM recommendations generated.",
  "batch_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "ml_predictions_generated": 0,
  "recommendations_generated": 24,
  "urgent_deals_flagged": 3
}
```

---

### Step 9: Generate Recommendation for a Single Deal

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:8000/api/v1/recommendations/generate/{deal_id}` |
| **Auth** | Bearer Token `{{token}}` |

Replace `{deal_id}` with an actual deal ID from your database. You can get one from Step 10.

**Expected Response (200):**
```json
{
  "status": "success",
  "message": "Recommendation generated successfully",
  "recommendations_generated": 1,
  "predictions_processed": 1,
  "adjusted_probability": 0.87,
  "recommendation_ar": "الصفقة في مرحلة متقدمة...",
  "recommendation_en": "Deal is in an advanced stage...",
  "risk_flag": "NONE"
}
```

---

### Step 10: Get All Deals (Paginated)

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:8000/api/v1/deals` |
| **Auth** | Bearer Token `{{token}}` |
| **Query Params** | `page=1`, `page_size=5`, `sort_by=ai_score` |

**Full URL:** `http://localhost:8000/api/v1/deals?page=1&page_size=5&sort_by=ai_score`

**Expected Response (200):**
```json
{
  "items": [
    {
      "deal_id": "6917488000000451005",
      "deal_name": "Enterprise License Deal",
      "account_name": "Acme Corp",
      "priority": "HIGH",
      "ml_score": 87.4,
      "ai_score": 91.0,
      "amount": 75000.0,
      "stage": "Negotiation/Review",
      "action_status": "need_action_now",
      "followup_count": 0
    }
  ],
  "total": 24,
  "page": 1,
  "page_size": 5,
  "total_pages": 5
}
```

**Available query params:**
- `search=Acme` — filter by deal name or account name
- `sort_by=ai_score|ml_score|amount|deal_name|risk`
- `include_closed=true` — show only Closed Won/Lost deals
- `page=2` — navigate pages

---

### Step 11: Get Deal Detail

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:8000/api/v1/deals/{deal_id}` |
| **Auth** | Bearer Token `{{token}}` |

**Expected Response (200):**
```json
{
  "deal_id": "6917488000000451005",
  "deal_name": "Enterprise License Deal",
  "account_name": "Acme Corp",
  "stage": "Negotiation/Review",
  "amount": 75000.0,
  "closing_date": "2026-09-30",
  "base_probability": 87.4,
  "adjusted_probability": 91.0,
  "recommendation_ar": "الصفقة في مرحلة متقدمة...",
  "recommendation_en": "Deal is in an advanced stage with confirmed budget...",
  "risk_flag": "NONE",
  "priority_tier": "HIGH",
  "client_phone": "+966501234567",
  "client_email": "client@acme.com",
  "action_status": "need_action_now",
  "followup_count": 2
}
```

---

### Step 12: Mark a Deal as Followed Up

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:8000/api/v1/followups/{deal_id}/mark` |
| **Auth** | Bearer Token `{{token}}` |

**Request Body:**
```json
{
  "channel": "whatsapp",
  "message_sent": "Hi, I wanted to follow up on our proposal...",
  "notes": "Client seemed interested, asked for final pricing"
}
```

**Expected Response (200):**
```json
{
  "status": "success",
  "message": "Follow-up recorded for 'Enterprise License Deal'.",
  "deal_id": "6917488000000451005",
  "followup_count": 3
}
```

---

### Step 13: Generate an AI WhatsApp Message

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:8000/api/v1/followups/{deal_id}/generate-message` |
| **Auth** | Bearer Token `{{token}}` |

**Request Body:**
```json
{
  "sales_rep_name": "Ahmed Hassan"
}
```

**Expected Response (200):**
```json
{
  "status": "success",
  "generated_message": "Hi [Client Name]! 👋 I hope you're doing well. I wanted to touch base regarding the Enterprise License proposal we discussed...",
  "deal_name": "Enterprise License Deal",
  "account_name": "Acme Corp",
  "client_phone": "+966501234567"
}
```

---

### Step 14: Get Notifications

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:8000/api/v1/notifications` |
| **Auth** | Bearer Token `{{token}}` |

**Expected Response (200):**
```json
{
  "items": [
    {
      "id": 42,
      "type": "follow_up_due",
      "title": "🔴 Follow-up: Enterprise License Deal",
      "body": "AI Score: 91.0%. Follow up immediately ⚡. Account: Acme Corp. Amount: $75,000.",
      "is_read": false,
      "created_at": "2026-06-09T08:30:00Z"
    }
  ],
  "unread_count": 7,
  "total": 15
}
```

---

### Step 15: Update Deal Stage (Inline Editing)

| | |
|---|---|
| **Method** | `PATCH` |
| **URL** | `http://localhost:8000/api/v1/deals/{deal_id}/stage` |
| **Auth** | Bearer Token `{{token}}` |

**Request Body:**
```json
{
  "new_stage": "Proposal/Price Quote"
}
```

**Valid stages:** `Qualification`, `Needs Analysis`, `Value Proposition`, `Identify Decision Makers`, `Proposal/Price Quote`, `Negotiation/Review`, `Closed Won`, `Closed Lost`

**Expected Response (200):**
```json
{
  "status": "success",
  "message": "Deal stage updated from 'Needs Analysis' to 'Proposal/Price Quote'.",
  "old_stage": "Needs Analysis",
  "new_stage": "Proposal/Price Quote"
}
```

---

### Quick Reference — All Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server health check |
| `POST` | `/api/v1/auth/login` | Login with email/password |
| `POST` | `/api/v1/auth/signup` | Create account + trigger OTP |
| `POST` | `/api/v1/auth/verify-otp` | Confirm OTP → get JWT |
| `POST` | `/api/v1/auth/google` | Google OAuth login |
| `GET` | `/api/v1/auth/users/me` | Current user profile |
| `PATCH` | `/api/v1/auth/users/me/templates` | Save outreach templates |
| `POST` | `/api/v1/ingest/deals` | Sync deals from Zoho |
| `POST` | `/api/v1/ingestion/upload` | Upload CSV/XLSX file |
| `POST` | `/api/v1/predict/deals` | ML prediction (inline, no DB) |
| `POST` | `/api/v1/jobs/run-predictions` | Batch ML prediction → save to DB |
| `POST` | `/api/v1/recommendations/generate` | Full AI pipeline (ML + LLM) |
| `POST` | `/api/v1/recommendations/generate/{deal_id}` | Single deal LLM analysis |
| `POST` | `/api/v1/recommendations/batch` | Batch LLM by batch_id |
| `GET` | `/api/v1/deals` | Paginated deal list |
| `POST` | `/api/v1/deals` | Create deal manually |
| `GET` | `/api/v1/deals/ranked` | Dashboard KPIs + ranked deals |
| `GET` | `/api/v1/deals/{deal_id}` | Full deal detail |
| `PATCH` | `/api/v1/deals/{deal_id}/stage` | Update deal stage |
| `GET` | `/api/v1/analytics/accounts/ranked` | Account performance ranking |
| `GET` | `/api/v1/accounts/names` | Account name list (dropdown) |
| `PATCH` | `/api/v1/recommendations/{deal_id}/action` | Mark recommendation as actioned |
| `POST` | `/api/v1/recommendations/{deal_id}/escalate` | Escalate deal to manager |
| `POST` | `/api/v1/batch/trigger` | Orchestrate full sync pipeline |
| `POST` | `/api/v1/followups/schedule` | Create follow-up records for all deals |
| `PATCH` | `/api/v1/followups/{deal_id}/days` | Update deferred follow-up period |
| `POST` | `/api/v1/followups/{deal_id}/mark` | Record a completed follow-up |
| `POST` | `/api/v1/followups/{deal_id}/generate-message` | Grok message generation |
| `POST` | `/api/v1/followups/{deal_id}/send-alert` | WhatsApp alert to sales rep |
| `GET` | `/api/v1/notifications` | Paginated notifications |
| `GET` | `/api/v1/notifications/unread-count` | Unread badge count |
| `PATCH` | `/api/v1/notifications/read-all` | Mark all notifications read |
| `PATCH` | `/api/v1/notifications/{id}/read` | Mark one notification read |

---

## 6. Key Concepts Explained Simply

### JWT Authentication

A **JSON Web Token (JWT)** is a self-contained credential. After you log in, the server creates a token that says "this person is user ID X, and this is valid until Y." The token is:
1. **Signed** with your `SECRET_KEY` using HMAC-SHA256 (`HS256`). Anyone can read the token, but they cannot fake one without knowing the secret key.
2. **Stored** in the browser's `localStorage`.
3. **Sent** automatically on every API request via the Axios interceptor.

The server never stores sessions. It just validates the signature on incoming tokens. If the token was issued by this server (same secret key), it is valid.

### ML Scaling (StandardScaler)

The Random Forest model was **trained** on standardized data. During training, the `StandardScaler` computed the mean and standard deviation of each feature across all training deals. At inference time, **the same scaler** (saved as `standard_scaler.pkl`) must be applied to new deals.

**Why?** A deal amount of $75,000 and a deal age of 45 days are on completely different scales. Standardization brings all features to mean=0 and std=1, so the model treats them equally. If you feed raw (unscaled) data to the trained model, the predictions are meaningless.

### ORM Sessions

An **ORM Session** (`SessionLocal()`) is like a shopping cart for database operations. You add, update, or delete objects in the session (in memory), and nothing hits the database until you call `db.commit()`. If an error occurs before commit, `db.rollback()` discards all pending changes.

**The `get_db()` generator pattern used by FastAPI:**
```python
def get_db():
    db = SessionLocal()
    try:
        yield db        # FastAPI injects this session into the endpoint function
    finally:
        db.close()      # Always closes the session, even if an exception occurs
```

`Depends(get_db)` tells FastAPI to run `get_db()` as a dependency for every request. The session is created before the endpoint runs and closed after, even on errors. This prevents connection leaks.

### Upsert (INSERT ON CONFLICT)

A standard `INSERT` fails if the primary key already exists. An **UPSERT** (PostgreSQL-specific) says: "INSERT this row, but if a row with this key already exists, UPDATE these columns instead."

```python
stmt = insert(ZohoDeal).values(**flattened_record)
upsert_stmt = stmt.on_conflict_do_update(
    index_elements=["id"],
    set_={c.name: c for c in stmt.excluded if c.name != "id"}
)
db.execute(upsert_stmt)
```

This makes the sync operation **idempotent** — you can run it 100 times and the database ends up in the same correct state each time. No duplicate rows, no crashes on existing data.

### Background Tasks

FastAPI's `BackgroundTasks` lets you schedule work to happen **after** the HTTP response is sent. When a deal is flagged as urgent, the WhatsApp alert is added as a background task:

```python
background_tasks.add_task(evaluate_and_notify, deal_name=..., owner_phone=...)
```

The API returns the JSON response immediately (fast user experience), and the WhatsApp message is sent in a separate thread after the response is delivered. The user never waits for the WhatsApp call to complete.

### The Two LLM Providers

| | Groq | Grok (xAI) |
|---|---|---|
| **Model** | `llama-3.3-70b-versatile` | `grok-3-latest` |
| **Used for** | AI Recommendations (structured JSON output) | Client message generation (conversational) |
| **API style** | OpenAI-compatible | OpenAI-compatible |
| **Fallback** | Has retry logic | Falls back to Groq if Grok fails |
| **Response format** | Forced JSON mode | Free text (prose messages) |

Groq was chosen for recommendations because of its high throughput for batch processing. Grok was chosen for message generation because of its stronger conversational quality.

---

*Generated on 2026-06-09 by a full codebase analysis. Covers all files in `app.py`, `controllers/`, `models/`, `services/`, `utils/`, and `frontend/src/`.*
