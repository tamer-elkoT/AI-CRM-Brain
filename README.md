# 🧠 AI CRM Brain — MVP v1.0

> **Transforming CRMs from passive data repositories into AI-driven decision engines.**
> 
> Arabic & English · FastAPI · PostgreSQL · Random Forest · Groq LLM · React 18

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat&logo=postgresql&logoColor=white)](https://postgresql.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 📋 Table of Contents

1. [What is AI CRM Brain?](#-what-is-ai-crm-brain)
2. [Value Proposition](#-value-proposition)
3. [System Architecture](#-system-architecture)
4. [Project Structure](#-project-structure)
5. [How It Works — Behind the Scenes](#-how-it-works--behind-the-scenes)
6. [API Reference](#-api-reference)
7. [Local Setup & Installation](#-local-setup--installation)
8. [Environment Variables](#-environment-variables)
9. [Database Schema](#-database-schema)
10. [Future Roadmap](#-future-roadmap)

---

## 🎯 What is AI CRM Brain?

**AI CRM Brain** is an intelligent middleware layer that sits on top of your existing CRM (currently Zoho) and transforms raw deal data into **actionable, AI-generated sales intelligence**.

Instead of your sales team staring at a static pipeline list, they get:

| Capability | What It Delivers |
|---|---|
| 🤖 **ML Deal Scoring** | Random Forest model predicts the probability of each deal closing — calibrated on your own historical data |
| 🧠 **LLM Recommendations** | Groq-powered Llama 3.3 70B generates a personalized **Arabic-first** (with English mirror) "Next Best Action" for each deal |
| 📱 **WhatsApp Automation** | Urgent deals automatically trigger WhatsApp alerts to the assigned sales rep — no manual intervention needed |
| 📊 **Intelligent Dashboard** | React dashboard ranks deals by AI score, shows risk flags, delta badges (▲/▼ vs ML base), and priority tiers |
| 🔄 **Automated Follow-ups** | APScheduler checks deferred follow-ups every 60 minutes and escalates time-sensitive deals |
| 🔐 **Secure Auth** | JWT-based login, Google OAuth SSO, and WhatsApp OTP verification for sales team onboarding |

### 🎯 The Core Problem We Solve

Sales managers in the MENA region manage 30–100+ active deals simultaneously across a CRM that shows everyone the same "stage" view. They cannot prioritize effectively — they rely on gut feel, and critical deals fall through the cracks.

**AI CRM Brain gives every sales manager a private AI analyst** that:
1. Reads all active deals from Zoho CRM
2. Scores each deal's closure probability using a trained ML model
3. Enriches that score with contextual reasoning using an LLM (deal amount, stage, custom fields, competitor presence, budget status)
4. Delivers a bilingual action recommendation directly to the rep's WhatsApp
5. Tracks the follow-up loop back to the database for model improvement

---

## 💡 Value Proposition

### Current State (MVP v1.0)

- ✅ **Predicts deal closure probability** using a Random Forest classifier trained on historical Zoho deal data
- ✅ **Generates bilingual recommendations** in Arabic (primary) and English — the LLM outputs a 2–3 sentence actionable next step per deal
- ✅ **Automates follow-up scheduling** — deals scoring ≥90% get flagged as "immediate action required"; others are deferred with a customizable timer (1–90 days)
- ✅ **Sends WhatsApp messages** — both rep alerts (urgent deal notifications) and AI-crafted client outreach messages via Grok (xAI) with Groq as fallback
- ✅ **Idempotent data pipeline** — every Zoho sync is safe to re-run without creating duplicates
- ✅ **Risk flagging** — LLM identifies `HIGH_RISK`, `STALLED`, `COMPETITOR_PRESENT`, `BUDGET_UNCERTAIN`, or `NONE` states and adjusts the probability accordingly

### Business Impact

> A sales team managing a $5M pipeline where the average deal is $50K can miss 10–15% of closable deals due to poor prioritization. Improving closure rate by just **+5% through better AI-assisted prioritization** directly translates to **$250,000+ in recovered revenue** — without adding headcount.

---

## 🏗 System Architecture

![System Architecture](dashboard/user_scenario/system_architecture.svg)

### How the Three Layers Interact

```
┌─────────────────────────────────────────────────────────────────┐
│                    REACT FRONTEND (Port 5173)                    │
│      Axios HTTP calls → FastAPI → PostgreSQL → Back to UI        │
└─────────────────────────────────────────────────────────────────┘
                              ▲ ▼ REST/JSON
┌─────────────────────────────────────────────────────────────────┐
│                   FASTAPI BACKEND (Port 8000)                    │
│  Controllers (routers) → Models (schema/ML/AI) → Services       │
│  APScheduler runs follow-up checks every 60 minutes             │
└─────────────────────────────────────────────────────────────────┘
                              ▲ ▼ SQLAlchemy ORM
┌─────────────────────────────────────────────────────────────────┐
│                 POSTGRESQL 16 (Port 5433 via Docker)             │
│  8 Tables: users · otp_codes · zoho_deals · ml_predictions      │
│  llm_recommendations · deal_followups · followup_logs ·          │
│  notifications                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
AI-CRM-Brain/
│
├── app.py                          # FastAPI entry point — registers all 8 routers
├── config.py                       # Pydantic settings — reads all vars from .env
├── requirements.txt                # Python dependencies (pinned versions)
├── docker-compose.yaml             # PostgreSQL 16 + pgAdmin 4 containers
│
├── controllers/                    # 📡 MVC: The "C" Layer — HTTP routers
│   ├── ingestion_controller.py     # POST /ingest/deals · /ingestion/upload
│   ├── ml_controller.py            # POST /ml/predict · /predict/batch
│   ├── recommendation_controller.py# POST /recommendations/generate (full AI pipeline)
│   ├── dashboard_controller.py     # GET /deals · /summary · /deals/{id}
│   ├── auth_controller.py          # POST /login · /signup · /verify-otp · /google
│   ├── action_controller.py        # POST /actions/actioned · /escalate
│   ├── followup_controller.py      # POST /followups · /generate-message · /send-alert
│   ├── notification_controller.py  # GET/POST /notifications
│   └── main_controller.py          # Health check helpers
│
├── models/                         # 🗂 MVC: The "M" Layer — data & ML
│   ├── schema.py                   # SQLAlchemy ORM: 8 table definitions
│   ├── database.py                 # SessionLocal + Base engine setup
│   ├── api_schemas.py              # Pydantic request/response schemas
│   ├── data_ingestion/
│   │   └── zoho_api.py             # OAuth token refresh + fetch_deals_schema()
│   ├── ml_engine/
│   │   ├── inference.py            # preprocess_new_deal() + predict_batch()
│   │   └── data_fusion.py          # fuse_deal_payload() — combines ML + deal context
│   └── ai_agents/
│       ├── recommender.py          # LLMRecommenderService — Groq API + retry + validate
│       └── prompts.py              # build_llm_prompt() + PROMPT_VERSION constant
│
├── services/                       # 🔧 Business logic (used by controllers)
│   ├── deal_classifier.py          # classify_all_deals() — triggered after every sync
│   ├── followup_scheduler.py       # check_deferred_followups() — APScheduler job
│   └── notification_service.py     # evaluate_and_notify() + send_whatsapp_otp()
│
├── utils/
│   ├── security.py                 # bcrypt hashing · JWT create/verify · SECRET_KEY
│   └── whatsapp_sender.py          # pywhatkit wrapper for WhatsApp sending
│
├── frontend/                       # ⚛️ MVC: The "V" Layer — React app
│   ├── src/                        # TypeScript source code
│   ├── vite.config.ts              # Vite config (proxies /api → :8000)
│   ├── tailwind.config.js          # TailwindCSS design tokens
│   └── package.json                # React 18 + TanStack Query + Recharts + Axios
│
├── weights/
│   └── random_forest_v1.pkl        # Trained Random Forest model artifact
│
├── artifacts/
│   ├── standard_scaler.pkl         # Fitted StandardScaler (must match training features)
│   └── feature_columns.json        # FEATURE_COLS list + stage_mapping + freq maps
│
├── notebooks/                      # 📓 EDA, feature engineering, model training
├── tests/                          # pytest test suite
├── data/                           # Raw and processed datasets
├── dashboard/
│   ├── user_scenario/              # SVG diagrams for documentation
│   │   ├── system_architecture.svg # Full system diagram
│   │   ├── user_flow.svg           # Sales manager user journey
│   │   └── mvc_interaction.svg     # Data & API flow diagram
│   └── EDA_&_Insights/             # EDA outputs and charts
└── .env                            # 🔑 Secret keys (NOT committed to git)
```

### How the MVC Pattern Works in Plain English

| Layer | Directory | Role |
|---|---|---|
| **Model** | `models/` | Knows how to talk to the database (`schema.py`), how to call external APIs (`zoho_api.py`, `recommender.py`), and how to run ML inference (`inference.py`). It has zero knowledge of HTTP. |
| **View** | `frontend/` | The React app that users interact with. Talks to the backend exclusively via HTTP (Axios). Never touches the database directly. |
| **Controller** | `controllers/` | The HTTP glue layer. Each controller file is a FastAPI `APIRouter`. It receives an HTTP request, calls the right model functions, and returns an HTTP response. It contains no business logic — only orchestration. |
| **Services** | `services/` | Background business logic that doesn't fit neatly into a single request/response cycle (APScheduler jobs, WhatsApp sending, deal classification runs). |

---

## 🔍 How It Works — Behind the Scenes

### Diagram: User Flow (Sales Manager Journey)

![User Flow](dashboard/user_scenario/user_flow.svg)

### Diagram: Data & API Flow

![Data and API Flow](dashboard/user_scenario/mvc_interaction.svg)

---

### 📥 When you click "Sync Now" — Step by Step

```
User clicks "Sync Now" in React dashboard
        ↓
1. React → POST /api/v1/ingest/deals
        ↓
2. ingestion_controller.py
   ├─ Calls zoho_api.fetch_deals_schema()
   │    ├─ Refreshes OAuth access_token using refresh_token
   │    └─ GET https://www.zohoapis.com/crm/v3/Deals (paginated)
   ├─ Collects all Contact IDs from deal objects
   ├─ Calls fetch_contacts_by_ids() → enriches with phone + email
   ├─ Flattens each nested JSON deal into a flat dict
   └─ INSERT ... ON CONFLICT(id) DO UPDATE → PostgreSQL zoho_deals table
        ↓
3. After successful upsert:
   ├─ classify_all_deals(db) runs automatically
   └─ Returns: { status, records_processed, classification }
        ↓
4. React refreshes deal list via GET /api/v1/deals
```

---

### 🤖 When you click "Generate AI Recommendations"

```
POST /api/v1/recommendations/generate
        ↓
── PHASE 1: ML Scoring ──────────────────────────────────────────
1. Find all zoho_deals WITHOUT a matching ml_prediction row
2. inference.preprocess_new_deal(raw_deals)
   ├─ Date engineering: Close_Year, Close_Month, Close_Quarter, Deal_Age_Days
   ├─ Frequency encoding: Owner_Freq, Account_Freq (from feature_columns.json)
   └─ StandardScaler.transform() → scaled feature matrix X
3. inference.predict_batch(X)
   ├─ rf_model.predict_proba(X) → probabilities for all 4 stage classes
   └─ base_probability = class[3] probability ("Won") × 100
4. INSERT ... ON CONFLICT(deal_id) DO UPDATE → ml_predictions table

── PHASE 2: LLM Recommendations ─────────────────────────────────
5. Find all ml_predictions WITHOUT a matching llm_recommendation row
6. data_fusion.fuse_deal_payload(db, prediction)
   └─ Combines: base_probability + stage + amount + closing_date
              + owner_name + account_name + custom_fields (JSONB)
7. recommender.generate_recommendation(fused_payload)
   ├─ prompts.build_llm_prompt() → few-shot messages[]
   ├─ Groq API: model=llama-3.3-70b-versatile, response_format=json_object
   ├─ Tenacity retry (3 attempts, exponential backoff on RateLimitError)
   ├─ Pydantic validate: LLMRecommendationOutput
   └─ Returns: {adjusted_probability, recommendation_ar, recommendation_en,
                risk_flag, risk_reasoning}
8. INSERT ... ON CONFLICT(deal_id, batch_id) DO UPDATE → llm_recommendations
9. Urgency check:
   ├─ IF (amount ≥ $50K AND adj_prob < 45%) OR risk_flag=HIGH_RISK → URGENT
   └─ BackgroundTask: evaluate_and_notify() → WhatsApp alert to rep
```

---

### 📋 When you click "Follow Up" on a deal

```
POST /api/v1/followups/{deal_id}/generate-message
        ↓
1. Fetch deal + latest LLM recommendation (AI score)
2. Build Grok prompt with deal context (stage, amount, closing_date, AI score)
3. Call Grok API (xAI) → grok-3-latest → personalized WhatsApp message
   └─ If Grok fails → fallback to Groq (Llama 3.3 70B)
        ↓
POST /api/v1/followups/{deal_id}/send-alert
        ↓
4. Look up rep's verified phone number in users table (is_whatsapp_verified=True)
5. Build formatted alert message with deal link, AI score, urgency
6. pywhatkit.sendwhatmsg_instantly() → sends to rep's WhatsApp
   └─ If pywhatkit fails → returns wa.me/[phone]?text=[encoded] link
        ↓
POST /api/v1/followups/{deal_id}/mark
        ↓
7. Creates FollowupLog record (channel, message_sent, notes)
8. Sets deal.action_status = "followed_up"
9. Marks pending DealFollowup records as notified
10. Creates in-app Notification for the deal owner
```

---

## 📡 API Reference

All endpoints are prefixed with `/api/v1`. Interactive docs available at `http://localhost:8000/docs`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health check |
| **Ingestion** | | |
| `POST` | `/ingest/deals` | Full Zoho CRM pull → upsert PostgreSQL |
| `POST` | `/ingestion/upload` | Upload CSV/XLSX file |
| **ML** | | |
| `POST` | `/ml/predict` | Score a single deal |
| `POST` | `/ml/predict/batch` | Score all unscored deals |
| **Recommendations** | | |
| `POST` | `/recommendations/generate` | Full AI pipeline (ML + LLM) for all deals |
| `POST` | `/recommendations/generate/{deal_id}` | AI pipeline for one deal |
| **Dashboard** | | |
| `GET` | `/deals` | Ranked deal list (sorted by AI score) |
| `GET` | `/deals/{deal_id}` | Full deal detail with ML + LLM data |
| `GET` | `/summary` | KPI cards (total, high priority, avg score) |
| **Auth** | | |
| `POST` | `/auth/login` | Email/password login → JWT |
| `POST` | `/auth/signup` | Register + send WhatsApp OTP |
| `POST` | `/auth/verify-otp` | Verify OTP → activate account + JWT |
| `POST` | `/auth/google` | Google OAuth SSO → JWT |
| `GET` | `/auth/users/me` | Current user profile |
| **Follow-ups** | | |
| `POST` | `/followups/schedule` | Schedule follow-ups for all active deals |
| `POST` | `/followups/{deal_id}/generate-message` | Grok-generated WhatsApp message |
| `POST` | `/followups/{deal_id}/send-alert` | Send WhatsApp alert to rep |
| `POST` | `/followups/{deal_id}/mark` | Record a completed follow-up |
| `PATCH` | `/followups/{deal_id}/days` | Customize deferred follow-up period |
| **Notifications** | | |
| `GET` | `/notifications` | Fetch in-app notifications for user |
| `POST` | `/notifications/{id}/read` | Mark notification as read |

---

## 🚀 Local Setup & Installation

### Prerequisites

- **Python 3.11+**
- **Node.js 18+** and npm
- **Docker Desktop** (for PostgreSQL + pgAdmin)
- **Git**

---

### Step 1 — Clone the Repository

```bash
git clone https://github.com/YOUR_ORG/AI-CRM-Brain.git
cd AI-CRM-Brain
```

---

### Step 2 — Set Up Python Virtual Environment

**Option A: Conda (recommended)**
```bash
conda create -n ai-crm-brain python=3.11 -y
conda activate ai-crm-brain
```

**Option B: venv**
```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate
```

---

### Step 3 — Install Python Dependencies

```bash
pip install -r requirements.txt
```

> ⚠️ **Windows note:** If `psycopg2-binary` fails, run `pip install psycopg2-binary --no-binary :all:` or install the [Visual C++ build tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/).

---

### Step 4 — Configure the `.env` File

Copy the template and fill in your credentials:

```bash
cp .env.example .env  # or manually create .env
```

Refer to the [Environment Variables](#-environment-variables) section below for the full list of required keys.

---

### Step 5 — Start PostgreSQL with Docker

```bash
docker-compose up -d
```

This starts:
- **PostgreSQL 16** on `localhost:5433`
- **pgAdmin 4** on `http://localhost:5050`

Verify the containers are running:
```bash
docker ps
```

---

### Step 6 — Run Database Migrations (Alembic)

```bash
# Initialize (first time only — only needed if alembic/ folder is missing)
alembic init alembic

# Apply all migrations to create tables
alembic upgrade head
```

Verify in pgAdmin (`http://localhost:5050`):
- Connect to `localhost:5433` with credentials from `.env`
- You should see 8 tables in the `ai_crm_brain` database

---

### Step 7 — Start the FastAPI Backend

```bash
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

Verify it's running:
```
✅ GET http://localhost:8000/health  →  {"status": "online"}
📚 GET http://localhost:8000/docs   →  Interactive Swagger UI
```

The APScheduler will also start in the background, checking deferred follow-ups every 60 minutes.

---

### Step 8 — Start the React Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

---

### ✅ You're Live!

| Service | URL | Credentials |
|---|---|---|
| React Dashboard | `http://localhost:5173` | Register via `/auth/signup` |
| FastAPI Swagger | `http://localhost:8000/docs` | — |
| pgAdmin 4 | `http://localhost:5050` | See `.env` |
| PostgreSQL | `localhost:5433` | See `.env` |

---

## 🔑 Environment Variables

Create a `.env` file in the project root with the following variables:

```dotenv
# ── LLM Settings (Groq — Primary LLM) ──────────────────────────
LLM_API_KEY=gsk_your_groq_api_key_here
LLM_PROVIDER=groq
LLM_MODEL_ID=llama-3.3-70b-versatile
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MAX_TOKENS=500
LLM_TEMPERATURE=0.3

# ── Grok Settings (xAI — WhatsApp Message Generation) ───────────
GROK_API_KEY=xai_your_grok_api_key_here
GROK_BASE_URL=https://api.x.ai/v1
GROK_MODEL=grok-3-latest

# ── Zoho CRM Settings ────────────────────────────────────────────
ZOHO_CLIENT_ID=your_zoho_client_id
ZOHO_CLIENT_SECRET=your_zoho_client_secret
SCOPE_NAME=ZohoCRM.modules.deals.READ,ZohoCRM.modules.contacts.READ
ZOHO_REFRESH_TOKEN=your_zoho_refresh_token

# ── PostgreSQL Settings ──────────────────────────────────────────
POSTGRES_USER=your_db_user
POSTGRES_PASSWORD=your_db_password
DB_NAME=ai_crm_brain
DB_PORT=5433

# ── pgAdmin Settings ─────────────────────────────────────────────
PGADMIN_EMAIL=admin@example.com
PGADMIN_PASSWORD=your_pgadmin_password

# ── App Settings ─────────────────────────────────────────────────
APP_BASE_URL=http://localhost:5173
BATCH_INTERVAL_MINUTES=30
```

> 🔐 **Never commit `.env` to git.** It is already listed in `.gitignore`.

### How to get your Zoho Refresh Token

1. Create a Zoho OAuth app at [api-console.zoho.com](https://api-console.zoho.com)
2. Set redirect URI to `http://localhost:8000`
3. Authorize with scope: `ZohoCRM.modules.deals.READ,ZohoCRM.modules.contacts.READ`
4. Exchange the authorization code for a refresh token using the Zoho OAuth endpoint


---

## 🗄 Database Schema

The system uses **8 PostgreSQL tables** that form a clear processing pipeline:

```
users ──────────────────────────────────────┐
otp_codes (FK → users)                      │
                                            │
zoho_deals ─────────────────────────────────┤
    │                                       │ (owner_name lookup)
    ├──▶ ml_predictions                     │
    │         │                             │
    │         └──▶ llm_recommendations ─────┤
    │                   │                   │
    ├──▶ deal_followups  │                   │
    ├──▶ followup_logs   │                   │
    └──▶ notifications ──────────────────────┘
```

| Table | Purpose |
|---|---|
| `users` | Registered sales reps/managers. Stores hashed password, role, phone, WhatsApp verification status, and outreach templates |
| `otp_codes` | 6-digit OTPs for 2-step WhatsApp phone verification during signup |
| `zoho_deals` | Single source of truth for all deal data — raw fields + enriched contact info + action tracking |
| `ml_predictions` | Random Forest output per deal — `base_probability`, `confidence_all_classes`, `batch_id` |
| `llm_recommendations` | LLM output — `adjusted_probability`, `recommendation_ar`, `recommendation_en`, `risk_flag`, computed `priority_tier` and `score_delta` |
| `deal_followups` | Scheduling table — tracks whether follow-up is `immediate` or `deferred` and when it was sent |
| `followup_logs` | Audit log of every completed follow-up action (channel, message sent, notes) |
| `notifications` | In-app notification inbox per user — supports `follow_up_due`, `deal_updated`, `score_changed` types |

---

## 🗺 Future Roadmap

### Phase 2 — Expanding CRM Integrations (Q3 2026)

- **HubSpot CRM Connector** — Mirror the Zoho pipeline with HubSpot's REST API v3, enabling teams already on HubSpot to use the same AI scoring engine without migrating data
- **Salesforce Integration** — OAuth 2.0 + Salesforce REST API connector for enterprise accounts

### Phase 3 — Domain-Specific AI Models (Q4 2026)

- **Real Estate Module** — Custom feature engineering and model weights tuned for property deals: price-per-sqm, location tier, developer reputation, payment plan flexibility
- **Automotive Module** — Specialized model for car dealership pipelines: model year, unit margin, financing status, competitive model presence
- **Custom Model Upload** — Teams can upload their own labeled CSV/Google Sheets data to retrain the ML model on their domain without writing code

### Phase 4 — Conversational AI (Q1 2027)

- **RAG-Based Business Chatbot** — Sales managers can ask natural language questions like _"Which deals in the Negotiation stage have a competitor present?"_ or _"Show me all stalled deals owned by Ahmed this month"_ — answered by an LLM with access to the live database via retrieval-augmented generation
- **Knowledge Base Integration** — Index company playbooks, product specs, and pricing sheets so the LLM can reference them in recommendations

### Phase 5 — Full Automation (Q2 2027)

- **WhatsApp AI Agent** — Replace manual follow-up with a fully autonomous WhatsApp agent that can hold a conversation with the client, answer FAQs, qualify interest, and book meetings — all triggered by a deal's AI score crossing a threshold
- **Multi-Channel Outreach** — Extend beyond WhatsApp to Email (via SendGrid) and SMS (via Twilio), with the LLM generating channel-appropriate message formats

### Phase 6 — Standalone CRM Platform (2027+)

- **AI CRM Brain becomes the CRM itself** — No dependency on Zoho or any external CRM. Full pipeline management: Leads → Contacts → Deals → Won/Lost with AI at every stage
- **Advanced Authentication** — Google OAuth 2.0 (already scaffolded), enterprise SSO (SAML/OIDC), and role-based access control (Admin / Sales Manager / Sales Rep)
- **Team Analytics** — Manager dashboard showing rep-level performance: closure rate by rep, average AI score at time of follow-up, recommendation acceptance rate, follow-up-to-close time

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make changes and add tests in `tests/`
4. Run tests: `pytest tests/ -v`
5. Submit a Pull Request with a clear description of the change

### Code Style

- Python: follow PEP 8; use type hints on all function signatures
- FastAPI: every endpoint must have a docstring and proper response model
- Database: all schema changes go through Alembic migrations — never `ALTER TABLE` directly

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

<div align="center">

**Built with ❤️ for the MENA sales community**

`FastAPI` · `PostgreSQL 16` · `Random Forest` · `Groq LLM (Llama 3.3 70B)` · `React 18` · `pywhatkit` · `Alembic` · `Docker`

</div>