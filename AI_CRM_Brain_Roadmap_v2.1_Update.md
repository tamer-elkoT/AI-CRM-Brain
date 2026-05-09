# AI CRM Brain — Roadmap Update v2.1
## Strategic Pivot: Deals-Only MVP Scope

> **Document Status:** Active  
> **Architecture:** MVC (FastAPI / PostgreSQL / React)  
> **Scope:** Zoho CRM — Deals Module Only (MVP v1.0)  
> **Timeline:** 6 Sprints · 6 Weeks  
> **Last Updated:** Sprint 1 In Progress

---

## Sprint 1 Progress Snapshot

| Task | Status |
|---|---|
| MVC directory structure initialized | ✅ DONE |
| Git repository + `.gitignore` + `.env` pattern | ✅ DONE |
| Zoho OAuth 2.0 token refresh flow (`zoho_api.py`) | ✅ DONE |
| Deals module JSON schema extracted | ✅ DONE |
| `flatten_deals_to_csv()` transformation utility | ✅ DONE |
| PostgreSQL schema design & migration | 🔄 IN PROGRESS |
| Historical Deals data injected into DB | ⏳ PENDING |
| Data Quality Report script | ⏳ PENDING |

---

## Section 1 — PostgreSQL Database Architecture (The Model Layer)

### 1.1 Strategic Design Decisions

The database is scoped exclusively to the **Deals module** for MVP v1.0. Three tables form the complete persistence layer, each mapping to a distinct processing stage in the pipeline:

```
[Zoho CRM API]
      │
      ▼
┌─────────────────┐     Standard      ┌─────────────────────┐
│   zoho_deals    │ ─── fields ──────▶│   ml_predictions    │
│  (raw + flat)   │                   │   (base ML score)   │
└─────────────────┘                   └─────────────────────┘
      │                                         │
      │  custom_fields (JSONB)                  │ base_probability
      │                                         ▼
      └────────────────────────────────▶ ┌──────────────────────┐
                                         │  llm_recommendations │
                                         │  (adjusted score +   │
                                         │   NL next action)    │
                                         └──────────────────────┘
```

---

### 1.2 Table Definitions

#### Table 1: `zoho_deals`

The single source of truth for all deal data. Serves a **dual purpose**: historical training corpus for the ML model AND the live prediction queue for active deals. The `is_closed_won` column is the ML target variable — `NULL` for open deals, `TRUE`/`FALSE` for closed ones.

```sql
CREATE TABLE zoho_deals (
    -- Primary Identity
    deal_pk           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    zoho_deal_id      VARCHAR(64) UNIQUE NOT NULL,          -- Zoho's own ID, used for upsert idempotency

    -- Standard Fields (ML Training Features — fixed schema, never changes)
    deal_name         TEXT,
    amount            NUMERIC(15, 2),
    stage             VARCHAR(100),                         -- Raw stage label from Zoho
    stage_encoded     SMALLINT,                             -- Ordinal: 1=Qualification, 2=Needs Analysis,
                                                            --          3=Value Proposition, 4=Proposal,
                                                            --          5=Negotiation, 6=Closed Won/Lost
    closing_date      DATE,
    probability       NUMERIC(5, 2),                        -- Zoho native estimate (0–100)
    expected_revenue  NUMERIC(15, 2),
    lead_source       VARCHAR(100),

    -- Flattened Nested Objects (from zoho_api.py flatten logic)
    account_name      TEXT,
    contact_name      TEXT,
    deal_owner        TEXT,

    -- Target Variable (NULL = open/active deal; populated only on deal closure)
    is_closed_won     BOOLEAN     DEFAULT NULL,

    -- Engineered Features (computed at ingestion time, stored for ML efficiency)
    deal_cycle_days   INT         GENERATED ALWAYS AS (
                          closing_date - CURRENT_DATE
                      ) STORED,
    amount_log        NUMERIC(10, 6),                       -- log1p(amount), computed in Python

    -- Custom / Unseen Fields (stored as JSONB — passed to LLM, NOT used in ML training)
    custom_fields     JSONB       DEFAULT '{}',

    -- Audit
    ingested_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    data_source       VARCHAR(20) DEFAULT 'zoho_api'        -- 'zoho_api' | 'manual_seed'
);

-- Indexes
CREATE INDEX idx_zoho_deals_stage          ON zoho_deals (stage);
CREATE INDEX idx_zoho_deals_is_closed_won  ON zoho_deals (is_closed_won);
CREATE INDEX idx_zoho_deals_closing_date   ON zoho_deals (closing_date);
CREATE INDEX idx_zoho_deals_ingested_at    ON zoho_deals (ingested_at DESC);
CREATE INDEX idx_zoho_deals_custom_fields  ON zoho_deals USING GIN (custom_fields);

-- Trigger: auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_zoho_deals_updated_at
    BEFORE UPDATE ON zoho_deals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

#### Table 2: `ml_predictions`

Stores the **base closure probability score** output by the XGBoost model. One row per deal per scoring run. Supports historical tracking of score changes over time via `scored_at`.

```sql
CREATE TABLE ml_predictions (
    prediction_pk       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_pk             UUID        NOT NULL REFERENCES zoho_deals(deal_pk) ON DELETE CASCADE,
    zoho_deal_id        VARCHAR(64) NOT NULL,               -- Denormalized for fast lookup without JOIN

    -- Model Output
    base_probability    NUMERIC(5, 4) NOT NULL,             -- XGBoost predict_proba output (0.0000–1.0000)
    base_score_pct      NUMERIC(5, 2)                       -- base_probability * 100, for display (e.g., 78.34)
        GENERATED ALWAYS AS (ROUND(base_probability * 100, 2)) STORED,

    -- Feature Snapshot (the exact feature vector used for this prediction — enables auditability)
    feature_vector      JSONB       NOT NULL,               -- {"amount_log": 10.2, "stage_encoded": 4, ...}

    -- Model Provenance
    model_version       VARCHAR(32) NOT NULL,               -- e.g., "xgb_v1.2.0" from MLflow registry
    model_run_id        VARCHAR(64),                        -- MLflow run_id for full experiment traceability

    -- Batch Metadata
    batch_id            UUID,                               -- Groups all predictions from the same pull cycle
    scored_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ml_predictions_deal_pk    ON ml_predictions (deal_pk);
CREATE INDEX idx_ml_predictions_batch_id   ON ml_predictions (batch_id);
CREATE INDEX idx_ml_predictions_scored_at  ON ml_predictions (scored_at DESC);

-- Constraint: a single deal cannot be scored twice in the same batch
CREATE UNIQUE INDEX uq_ml_pred_deal_batch
    ON ml_predictions (deal_pk, batch_id);
```

---

#### Table 3: `llm_recommendations`

Stores the **final output surface**: the LLM-adjusted probability and the natural language "Next Best Action" recommendation. One row per deal per batch. This is what the React dashboard reads.

```sql
CREATE TABLE llm_recommendations (
    recommendation_pk   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_pk       UUID        NOT NULL REFERENCES ml_predictions(prediction_pk) ON DELETE CASCADE,
    deal_pk             UUID        NOT NULL REFERENCES zoho_deals(deal_pk) ON DELETE CASCADE,
    zoho_deal_id        VARCHAR(64) NOT NULL,

    -- LLM Input Package (what was sent to Claude — stored for debugging and prompt improvement)
    llm_payload         JSONB       NOT NULL,               -- {base_probability, stage, custom_fields, few_shot_examples}

    -- LLM Output
    adjusted_probability  NUMERIC(5, 4) NOT NULL,           -- Claude's final calibrated score (0.0000–1.0000)
    adjusted_score_pct    NUMERIC(5, 2)
        GENERATED ALWAYS AS (ROUND(adjusted_probability * 100, 2)) STORED,
    score_delta           NUMERIC(5, 2)
        GENERATED ALWAYS AS (
            ROUND((adjusted_probability - (llm_payload->>'base_probability')::NUMERIC) * 100, 2)
        ) STORED,                                           -- Signed delta: positive = LLM upgraded, negative = downgraded

    -- Natural Language Recommendation (Arabic + English)
    recommendation_ar   TEXT        NOT NULL,               -- Arabic "Next Best Action" for the sales rep
    recommendation_en   TEXT,                               -- Optional English mirror (for bilingual teams)

    -- Priority Tier (derived from adjusted_score_pct for dashboard sorting)
    priority_tier       VARCHAR(10)
        GENERATED ALWAYS AS (
            CASE
                WHEN adjusted_probability >= 0.75 THEN 'HIGH'
                WHEN adjusted_probability >= 0.45 THEN 'MEDIUM'
                ELSE 'LOW'
            END
        ) STORED,

    -- LLM Provenance
    llm_model_id        VARCHAR(64) NOT NULL,               -- e.g., "claude-sonnet-4-5"
    prompt_version      VARCHAR(16) NOT NULL,               -- e.g., "v1.3" — tracks few-shot template version
    llm_latency_ms      INT,                                -- Round-trip latency to Anthropic API

    -- Batch linkage
    batch_id            UUID,
    generated_at        TIMESTAMPTZ DEFAULT NOW(),

    -- Sales Rep Feedback Loop (populated when rep acts on or dismisses the recommendation)
    rep_action_taken    BOOLEAN     DEFAULT NULL,           -- NULL = not yet reviewed
    rep_feedback_at     TIMESTAMPTZ DEFAULT NULL
);

-- Indexes
CREATE INDEX idx_llm_rec_deal_pk          ON llm_recommendations (deal_pk);
CREATE INDEX idx_llm_rec_priority_tier    ON llm_recommendations (priority_tier);
CREATE INDEX idx_llm_rec_generated_at     ON llm_recommendations (generated_at DESC);
CREATE INDEX idx_llm_rec_batch_id         ON llm_recommendations (batch_id);

-- Primary query the dashboard runs: latest recommendation per deal, sorted by priority
CREATE INDEX idx_llm_rec_dashboard_query
    ON llm_recommendations (deal_pk, generated_at DESC, adjusted_probability DESC);
```

---

### 1.3 Entity Relationship Summary

```
zoho_deals
    │ deal_pk (PK)
    │
    ├──▶ ml_predictions
    │        │ prediction_pk (PK)
    │        │ deal_pk (FK → zoho_deals)
    │        │
    │        └──▶ llm_recommendations
    │                 │ recommendation_pk (PK)
    │                 │ prediction_pk (FK → ml_predictions)
    │                 │ deal_pk (FK → zoho_deals)
    │                 └─ [final output surface — read by dashboard]
```

**Cardinality:**
- `zoho_deals` → `ml_predictions` : **1-to-Many** (one deal scored across multiple batch runs)
- `ml_predictions` → `llm_recommendations` : **1-to-1** (one LLM call per ML prediction)

---

### 1.4 The Upsert Pattern (Idempotent Ingestion)

Every ingestion run uses `INSERT ... ON CONFLICT DO UPDATE` (upsert) keyed on `zoho_deal_id`. This guarantees the pipeline is safe to re-run without creating duplicate records.

```python
# controllers/ingestion_controller.py
from sqlalchemy.dialects.postgresql import insert as pg_insert

async def upsert_deal(session: AsyncSession, deal_data: dict) -> None:
    stmt = pg_insert(ZohoDeal).values(**deal_data)
    stmt = stmt.on_conflict_do_update(
        index_elements=["zoho_deal_id"],
        set_={
            "stage":          stmt.excluded.stage,
            "stage_encoded":  stmt.excluded.stage_encoded,
            "amount":         stmt.excluded.amount,
            "probability":    stmt.excluded.probability,
            "closing_date":   stmt.excluded.closing_date,
            "custom_fields":  stmt.excluded.custom_fields,
            "updated_at":     stmt.excluded.updated_at,
        }
    )
    await session.execute(stmt)
```

---

## Section 2 — Updated 6-Sprint Execution Plan (Deals-Only Scope)

> **Scope Lock:** All sprints operate exclusively on the `zoho_deals`, `ml_predictions`, and `llm_recommendations` tables. Activities and Customers/Leads integration is formally deferred to **v2.0**.

---

### Sprint 1 — Foundation & Data Infrastructure
**Week 1 · Theme: Zoho → PostgreSQL Pipeline**

#### ✅ COMPLETED TASKS

- [x] MVC repository structure initialized (`models/`, `views/`, `controllers/`, `tests/`)
- [x] `.env` pattern established; `.env` added to `.gitignore`
- [x] `requirements.txt` created with all Sprint 1 dependencies
- [x] Zoho OAuth 2.0 Authorization Code flow implemented (`get_new_access_token()`)
- [x] `fetch_deals_schema()` — GET `/crm/v3/Deals` with field selection working
- [x] `flatten_deals_to_csv()` — JSON-to-flat-structure transformation working
- [x] Real JSON schema captured and saved (`real_sample_deals.json`)

#### 🔄 REMAINING TASKS (Sprint 1 Close-Out)

**Task 1.6 — Stand Up PostgreSQL + pgAdmin 4**
- Deploy PostgreSQL 16 via Docker Compose
- Configure `docker-compose.yml` with `db` service and `pgadmin` service
- Confirm pgAdmin 4 can connect to the running container

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ai_crm_brain
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]

  pgadmin:
    image: dpage/pgadmin4
    environment:
      PGADMIN_DEFAULT_EMAIL: ${PGADMIN_EMAIL}
      PGADMIN_DEFAULT_PASSWORD: ${PGADMIN_PASSWORD}
    ports: ["5050:80"]

volumes:
  pgdata:
```

**Task 1.7 — Run Alembic Migrations**
- Initialize Alembic: `alembic init alembic`
- Write migration script for all three table definitions above
- Execute: `alembic upgrade head`
- Verify all three tables and indexes are visible in pgAdmin 4

**Task 1.8 — Build the `DealIngestionService`**
- Refactor `zoho_api.py` into a proper service class: `ZohoCRMClient`
- Move `flatten_deals_to_csv()` logic into a `transform_deal()` method that returns a validated Pydantic model
- Implement the upsert function shown above
- Write `ingest_all_deals()` — paginated pull of all deals from Zoho using `page` and `per_page` params

**Task 1.9 — Data Validation Layer (V-1 / V-2 / V-3)**
- V-1: Reject records where `Amount IS NULL` OR `Stage IS NULL` OR `Closing_Date IS NULL`
- V-2: Assert `Amount` is numeric, `Closing_Date` parses as valid ISO date, `Probability` is 0–100
- V-3: Flag `Closing_Date` older than 2 years or more than 5 years in the future
- Route failed records to a `flagged_records` table (schema: `zoho_deal_id`, `failure_stage`, `reason`, `raw_payload`, `flagged_at`)

**Task 1.10 — Data Quality Report Script**
- After each ingestion run, write `scripts/data_quality_report.py`
- Output JSON: `{ total_fetched, passed_validation, failed_v1, failed_v2, failed_v3, top_failure_fields, run_duration_seconds, timestamp }`
- Print formatted summary to stdout; persist report to `logs/quality_reports/`

#### ✅ Sprint 1 Deliverable
> **A fully operational, idempotent data pipeline.** Running `python scripts/ingest.py` triggers an OAuth-authenticated Zoho pull → validation → upsert into `zoho_deals`. At least 20+ real deal records are visible and queryable in pgAdmin 4. A JSON quality report is generated in `logs/quality_reports/`. Zero raw CSVs in the codebase.

---

### Sprint 2 — Feature Engineering & Exploratory Data Analysis
**Week 2 · Theme: Transform Raw Deals into an ML-Ready Feature Matrix**

#### Goals

- **EDA Notebook** (`notebooks/01_eda_deals.ipynb`):
  - Load `zoho_deals` directly from PostgreSQL using `pd.read_sql()`
  - Plot: `amount` distribution (log scale), `stage` frequency, `probability` vs. `is_closed_won` correlation
  - Audit class balance: ratio of `is_closed_won = TRUE` vs `FALSE`
  - Flag if imbalance exceeds 3:1 → trigger SMOTE decision in Sprint 3

- **Feature Engineering Pipeline** (`models/ml_engine/feature_pipeline.py`):

| Input Column | Engineered Feature | Transformation |
|---|---|---|
| `amount` | `amount_log` | `np.log1p(amount)` |
| `stage` | `stage_encoded` | Ordinal map (1–6) |
| `closing_date` | `days_to_close` | `(closing_date - today).days` |
| `probability` | `probability_norm` | `probability / 100` |
| `lead_source` | `lead_source_ohe` | One-hot encoding (top N + "Other") |
| `is_closed_won` | `target` | Binary (1=Won, 0=Lost); rows where NULL excluded from training |

  - All transformations wrapped in a `scikit-learn Pipeline` with `ColumnTransformer`
  - Imputation: median for numeric, `"Unknown"` for categorical
  - Fit the pipeline on training set ONLY; serialise to `models/ml_engine/artifacts/feature_pipeline.pkl`

- **Time-Based Train/Test Split**:
  - Sort `zoho_deals` by `ingested_at` ascending
  - Train: all closed deals before cutoff date (e.g., 75th percentile of `closing_date`)
  - Test: all closed deals after cutoff date
  - **Never use `random_state` split on time-series sales data**

- **Feature Dictionary** (`docs/feature_dictionary.md`): Document every feature, its type, source column, and transformation logic

#### Sprint 2 Deliverable
> Serialized `feature_pipeline.pkl`. Time-split arrays `(X_train, X_test, y_train, y_test)` saved to `data/processed/`. EDA notebook committed to `notebooks/` with key observations documented. Feature dictionary written.

---

### Sprint 3 — ML Model Training, Evaluation & Explainability
**Week 3 · Theme: XGBoost Training + SHAP Analysis**

#### Goals

- **Model Training** (`models/ml_engine/train_model.py`):
  - Train primary model: `XGBoostClassifier` with `scale_pos_weight` tuned to class ratio
  - Train baseline: `RandomForestClassifier` (aligns with data flow diagram) and `LogisticRegression`
  - Hyperparameter tuning via `GridSearchCV` or `Optuna` (time-boxed to 2 hours max)

- **Evaluation Protocol**:
  - Primary metric: **AUC-ROC** (handles class imbalance correctly)
  - Secondary: Precision-Recall curve, F1-score at 0.5 threshold
  - Log all runs to MLflow: hyperparameters, metrics, dataset hash, feature list

- **SHAP Explainability** (`notebooks/02_shap_analysis.ipynb`):
  - Run `shap.TreeExplainer` on the XGBoost model
  - Produce SHAP summary plot — identify top 5 closure-driving features
  - Store per-deal SHAP values in `feature_vector` JSONB column of `ml_predictions` (enables dashboard feature breakdown)

- **Model Registration**:
  - Register the best-performing model in the MLflow Model Registry as `deal_closure_predictor`
  - Tag with version: `xgb_v1.0.0`
  - Serialise to `models/ml_engine/artifacts/xgb_model.pkl`

- **FastAPI Inference Endpoint**:
  - `POST /api/v1/predict/deal` — accepts a single deal payload, returns `base_probability`
  - Load model from artifact store at startup via FastAPI `lifespan` event
  - Write pytest unit test: mock deal payload → assert response shape and probability range (0–1)

#### Sprint 3 Deliverable
> Trained, evaluated, and MLflow-registered XGBoost model (`xgb_v1.0.0`). AUC-ROC > 0.70 target (if not reached, document why and proceed with best available model). `POST /api/v1/predict/deal` endpoint passing all pytest integration tests. SHAP summary plot committed to `docs/`.

---

### Sprint 4 — LLM Integration, Data Fusion & Active Batch Pull
**Week 4 · Theme: Few-Shot Prompting + APScheduler Batch Pipeline**

#### Goals

- **Few-Shot Prompt Template** (`models/ai_agents/recommender.py`):

```python
SYSTEM_PROMPT = """
You are an expert AI Sales Strategist for a CRM analytics platform.
Your task is to evaluate a sales deal and provide:
1. An adjusted_probability (float, 0.00–1.00) that refines the ML model's base score
   based on contextual factors the ML model cannot see.
2. A recommendation_ar (string) — a concise, actionable 2-3 sentence "Next Best Action"
   written in Arabic for the sales representative.

Output ONLY valid JSON in this exact schema:
{
  "adjusted_probability": <float>,
  "recommendation_ar": "<Arabic text>"
}
"""

FEW_SHOT_EXAMPLES = [
    {
        "input": {
            "base_probability": 0.82,
            "stage": "Negotiation",
            "days_to_close": 7,
            "custom_fields": {"Competitor_Present": "None", "Budget_Approved": "Yes"}
        },
        "output": {
            "adjusted_probability": 0.89,
            "recommendation_ar": "الصفقة في مرحلة متقدمة جداً والميزانية محددة. تواصل مع صاحب القرار مباشرةً هذا الأسبوع لإتمام التوقيع. لا تترك أي نقاط مفتوحة."
        }
    },
    # ... 2–4 more examples covering Closed-Lost scenarios and competitor presence
]
```

  - Validate LLM JSON response against a Pydantic model before DB write
  - Implement retry with corrective prompt on parse failure (max 2 retries)
  - Fallback: if LLM fails after retries, set `adjusted_probability = base_probability`, `recommendation_ar = NULL`

- **Data Fusion / Concatenation** (as shown in the data flow diagram):
  - Build `fuse_deal_payload()`: combines `base_probability` (from `ml_predictions`) + raw `custom_fields` (from `zoho_deals`) + few-shot examples into a single JSON package
  - This is the `Fused JSON Data Package` node in the architecture diagram

- **Active Batch Pull** (`controllers/batch_controller.py`):

```python
@scheduler.scheduled_job("interval", minutes=30,
                          id="active_batch_pull",
                          max_instances=1)       # Prevent overlapping runs
async def active_batch_pull():
    batch_id = uuid4()
    deals = await zoho_client.get_open_deals()   # Stage NOT IN ('Closed Won', 'Closed Lost')
    validated = validation_pipeline.run(deals)
    predictions = scoring_service.score_batch(validated, batch_id=batch_id)  # Vectorised XGBoost
    await db.upsert_ml_predictions(predictions, batch_id=batch_id)
    recommendations = await asyncio.gather(
        *[llm_service.generate(p) for p in predictions],
        return_exceptions=True                   # Isolate per-deal LLM failures
    )
    await db.upsert_llm_recommendations(recommendations, batch_id=batch_id)
    logger.info(f"Batch {batch_id}: {len(predictions)} deals scored.")
```

- **Dashboard REST Endpoint**:
  - `GET /api/v1/deals/ranked` — joins `zoho_deals` + latest `llm_recommendations` per deal
  - Query orders by `adjusted_probability DESC`, filters `priority_tier`
  - Returns paginated response: `{ deals: [...], total: N, page: 1, batch_id: "..." }`

#### Sprint 4 Deliverable
> End-to-end scoring pipeline operational: Zoho pull → XGBoost score → Data Fusion → Claude LLM → `llm_recommendations` table. APScheduler running on 30-minute intervals in Docker. `GET /api/v1/deals/ranked` returns correctly structured, sorted JSON. All services covered by pytest unit and integration tests.

---

### Sprint 5 — React Dashboard (The View Layer)
**Week 5 · Theme: North Star UI Build**

> See **Section 3** below for the complete UI specification and component breakdown. The engineering team builds directly to that spec.

#### Goals

- Scaffold React app with Vite: `npm create vite@latest views/dashboard -- --template react-ts`
- Install: `axios`, `tailwindcss`, `shadcn/ui`, `recharts`, `react-query`
- Implement all components defined in the UI Vision (Section 3)
- Connect to `GET /api/v1/deals/ranked` via `react-query` polling (30-second refetch interval to sync with batch pull cadence)
- Configure FastAPI CORS middleware to allow requests from the React dev server
- Conduct end-to-end integration test: Zoho pull → DB → API → React renders ranked list correctly
- Performance target: full batch score for 500 deals under 5 seconds (XGBoost vectorised + LLM async parallelism)

#### Sprint 5 Deliverable
> Fully integrated React dashboard consuming live FastAPI data. Sales manager can view ranked deal list with probability badges, priority tiers, and Arabic NL recommendations. All critical user flows demonstrated in a recorded Loom walkthrough.

---

### Sprint 6 — Hardening, Demo & Delivery
**Week 6 · Theme: Polish, Pitch, and Ship**

#### Goals

- **System Hardening**:
  - Add structured logging (`structlog`) across all services — every API call, batch run, and LLM request logged with `batch_id` for full traceability
  - Implement global FastAPI exception handler: never expose stack traces to the client
  - Add `GET /api/v1/health` endpoint: checks DB connectivity and MLflow artifact availability
  - Rate limit the Zoho API client: honour `X-RATELIMIT-REMAINING` header, implement exponential backoff on 429 responses

- **Documentation**:
  - Auto-generated OpenAPI docs confirmed at `/docs` (FastAPI built-in)
  - `README.md`: local dev setup in under 5 commands
  - Model card: `docs/model_card_xgb_v1.md` — training data, evaluation metrics, known limitations
  - `docs/prompt_engineering.md`: few-shot template versioning rationale and example evolution log

- **Demo Recording** (5–8 minutes):
  - Open dashboard → show ranked deal list → click into HIGH priority deal → read Arabic recommendation → demonstrate score delta badge (LLM upgrade/downgrade)
  - Trigger a manual batch pull → show dashboard update in real time

- **Business Case Slide**:
  - Model: current close rate × deal pipeline value → projected improvement at +5% close rate uplift → ROI calculation

- **Pitch Deck** (6–8 slides): Problem → Solution → Live Demo → Data Flow Architecture → ROI Model → Roadmap to v2.0

#### Sprint 6 Deliverable
> Demo-ready, hardened system. Full documentation suite committed to `docs/`. Pitch deck exported to PDF. `docker-compose up` spins the entire stack — DB, API, and dashboard — in one command.

---

## Section 3 — MVP v1.0 UI Vision: The React Dashboard

> This section is the **North Star specification** for the Sprint 5 View layer build. Every component described below maps directly to data available from `GET /api/v1/deals/ranked`.

---

### 3.1 Overall Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│  HEADER BAR                                                            │
│  [🧠 AI CRM Brain]          [Last synced: 2 mins ago] [Sync Now ▶]    │
├─────────────────────┬──────────────────────────────────────────────────┤
│                     │                                                  │
│   SIDEBAR           │   MAIN CONTENT AREA                             │
│                     │                                                  │
│   📊 Dashboard      │   ┌─── PIPELINE SUMMARY CARDS ─────────────┐   │
│   🔥 Priority Deals │   │  [Total Deals] [High Priority] [At Risk] │   │
│   📈 Analytics      │   └──────────────────────────────────────────┘  │
│   ⚙️  Settings       │                                                  │
│                     │   ┌─── RANKED DEALS TABLE ──────────────────┐   │
│                     │   │  (see 3.3 below)                         │   │
│                     │   └──────────────────────────────────────────┘  │
│                     │                                                  │
└─────────────────────┴──────────────────────────────────────────────────┘
```

---

### 3.2 Header Bar

- **Left:** Product logo + name "AI CRM Brain" (Arabic subtitle: العقل المركزي لإدارة العملاء)
- **Center:** Batch status indicator — "Last synced: 2 mins ago" with a green dot (live) or yellow dot (stale > 35 min)
- **Right:** "Sync Now" button → calls `POST /api/v1/batch/trigger` → shows a spinner while the batch processes → refreshes the table on completion

---

### 3.3 Pipeline Summary Cards (Top Row)

Three metric cards displayed in a row:

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Active Deals    │  │  High Priority   │  │  Avg. Score      │
│  ─────────────   │  │  ─────────────   │  │  ─────────────   │
│     48           │  │  🔴 12           │  │   67.4%          │
│                  │  │  (Score ≥ 75%)   │  │  (All active)    │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

Data source: aggregate query on `llm_recommendations` — count, filter by `priority_tier`, and `AVG(adjusted_score_pct)`.

---

### 3.4 Ranked Deals Table (Main Content Area)

The primary interaction surface. Sorted by `adjusted_probability DESC` by default. Supports client-side filtering by `priority_tier`.

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ 🔍 Search deals...                          Filter: [All ▼]  [High ▼]  [Sort: Score ▼]  │
├────────┬──────────────────┬───────────┬──────────────────┬──────────────────┬────────────┤
│ TIER   │ DEAL NAME        │ ACCOUNT   │  ML SCORE        │  AI SCORE        │ CLOSE DATE │
├────────┼──────────────────┼───────────┼──────────────────┼──────────────────┼────────────┤
│ 🔴 HIGH │ Enterprise CRM   │ TechFlow  │  ████████░  72%  │  ████████▉  89%  │ 15 Jun     │
│        │                  │           │  (base)          │  ▲ +17pts        │            │
├────────┼──────────────────┼───────────┼──────────────────┼──────────────────┼────────────┤
│ 🟡 MED │ SaaS Platform    │ Nexus LLC │  ██████░░░  61%  │  ██████░░░  63%  │ 22 Jun     │
│        │                  │           │  (base)          │  ▲ +2pts         │            │
├────────┼──────────────────┼───────────┼──────────────────┼──────────────────┼────────────┤
│ 🔴 HIGH │ Q3 Expansion     │ AlTech    │  █████░░░░  54%  │  ████████░  78%  │ 30 Jun     │
│        │                  │           │  (base)          │  ▲ +24pts        │            │
├────────┼──────────────────┼───────────┼──────────────────┼──────────────────┼────────────┤
│ 🟢 LOW  │ SMB Onboarding   │ QuickMart │  ████░░░░░  38%  │  ███░░░░░░  31%  │ 10 Jul     │
│        │                  │           │  (base)          │  ▼ -7pts         │            │
└────────┴──────────────────┴───────────┴──────────────────┴──────────────────┴────────────┘
```

**Column Details:**
- **TIER badge:** Color-coded pill — 🔴 HIGH (≥75%), 🟡 MEDIUM (45–74%), 🟢 LOW (<45%)
- **ML SCORE:** Progress bar in muted blue showing `base_score_pct` — labeled "(base)"
- **AI SCORE:** Progress bar in solid teal/green showing `adjusted_score_pct` — includes delta badge (▲/▼ +Npts) in green/red
- **Clicking any row** opens the Deal Detail Drawer (see 3.5)

---

### 3.5 Deal Detail Drawer (Slide-in Panel)

Clicking a row opens a right-side drawer — no page navigation, no modal. The sales rep never loses context of the ranked list.

```
┌─────────────────────────────────────────────────────────────┐
│ ✕   Enterprise CRM Deal                        [Open in Zoho ↗]│
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Account: TechFlow Inc.     Owner: Ahmed Hassan              │
│  Value: $48,000             Closing: June 15, 2025          │
│  Stage: Negotiation                                          │
│                                                              │
├──── PROBABILITY BREAKDOWN ───────────────────────────────────┤
│                                                              │
│  ML Base Score       AI-Adjusted Score    Score Delta        │
│  ┌──────────┐        ┌──────────┐         ┌──────────┐      │
│  │   72%    │   ──▶  │   89%    │         │  ▲ +17   │      │
│  │ (model)  │        │  (final) │         │  pts     │      │
│  └──────────┘        └──────────┘         └──────────┘      │
│                                                              │
├──── 🤖 AI RECOMMENDATION (التوصية) ─────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  الصفقة في مرحلة تفاوض متقدمة والعميل أكد الميزانية.  │  │
│  │  تواصل مع مدير TechFlow مباشرةً خلال 48 ساعة لإتمام   │  │
│  │  الاتفاقية. لا يوجد منافس حالياً — الفرصة مثالية.     │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
├──── WHY THIS SCORE? (Top SHAP Factors) ──────────────────────┤
│                                                              │
│  ✅ Deal Amount: $48K (above avg win range)    +12.3%        │
│  ✅ Stage: Negotiation (strong signal)         +9.7%         │
│  ✅ No Competitor Present (custom field)       +8.1%         │
│  ⚠️  Days to Close: 7 (tight deadline)         -2.4%         │
│                                                              │
├──── ACTIONS ─────────────────────────────────────────────────┤
│                                                              │
│  [✅ Mark as Actioned]   [⏰ Remind me tomorrow]   [✗ Dismiss]│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Component Notes:**
- **Probability Breakdown:** Three KPI cards in a horizontal row — Base Score (blue), AI Score (teal), Delta badge (green/red based on sign)
- **AI Recommendation box:** RTL-aligned Arabic text, larger font size, subtle teal background — the most visually prominent element in the drawer
- **SHAP Factors:** Ranked list of top 4 features with signed contribution percentages. Data comes from `feature_vector` JSONB in `ml_predictions`. Green checkmark = positive contribution, yellow warning = negative
- **Actions row:** Clicking "Mark as Actioned" writes `rep_action_taken = TRUE` + `rep_feedback_at = NOW()` to `llm_recommendations` — closing the feedback loop for future model evaluation

---

### 3.6 Component-to-API Mapping

| UI Component | API Endpoint | DB Source |
|---|---|---|
| Pipeline summary cards | `GET /api/v1/deals/summary` | Aggregation on `llm_recommendations` |
| Ranked deals table | `GET /api/v1/deals/ranked` | JOIN `zoho_deals` + `llm_recommendations` |
| Deal detail drawer | `GET /api/v1/deals/{deal_pk}` | `zoho_deals` + `ml_predictions` + `llm_recommendations` |
| SHAP factors | Included in deal detail response | `feature_vector` JSONB from `ml_predictions` |
| Rep action buttons | `PATCH /api/v1/recommendations/{rec_pk}/action` | `llm_recommendations.rep_action_taken` |
| Manual sync button | `POST /api/v1/batch/trigger` | Triggers `active_batch_pull()` immediately |

---

### 3.7 Tech Stack for the View Layer

```
React 18 + TypeScript + Vite
├── Styling:       TailwindCSS + shadcn/ui (Drawer, Badge, Card, Table components)
├── Data Fetching: TanStack Query (react-query) — 30s polling on ranked list
├── Charts:        Recharts — probability progress bars, future: score trend sparklines
├── RTL Support:   CSS `direction: rtl` scoped to recommendation text blocks
└── Icons:         Lucide React
```

---

*End of Roadmap Update v2.1*

---

> **Next Action Required:** Confirm dashboard tech stack (React confirmed per above). Assign Sprint 2 EDA notebook ownership. Schedule Sprint 1 close-out review after Task 1.10 (Data Quality Report) is merged.
