# 🧠 AI CRM Brain — Rabih CRM MVP v1.0

> **Transforming CRMs from passive data repositories into AI-driven decision engines.**
>
> Arabic & English · FastAPI · PostgreSQL · Random Forest · Multi-LLM · React 18 · Docker

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat&logo=postgresql&logoColor=white)](https://postgresql.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat&logo=docker&logoColor=white)](https://docker.com)
[![Node.js](https://img.shields.io/badge/Node.js-18-339933?style=flat&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 📋 Table of Contents

1. [What is AI CRM Brain?](#-what-is-ai-crm-brain)
2. [Value Proposition](#-value-proposition)
3. [Technology Stack](#-technology-stack)
4. [System Architecture](#-system-architecture)
5. [Project Structure](#-project-structure)
6. [How It Works — Behind the Scenes](#-how-it-works--behind-the-scenes)
7. [Running with Docker (Recommended)](#-running-with-docker-recommended)
8. [Running Locally (Development)](#-running-locally-development)
9. [API Reference](#-api-reference)
10. [Environment Variables](#-environment-variables)
11. [Database Schema](#-database-schema)
12. [Future Roadmap](#-future-roadmap)

---

## 🎯 What is AI CRM Brain?

**AI CRM Brain** (branded as **Rabih CRM**) is an intelligent middleware layer that sits on top of your existing CRM (currently Zoho) and transforms raw deal data into **actionable, AI-generated sales intelligence**.

Instead of your sales team staring at a static pipeline list, they get:

| Capability | What It Delivers |
|---|---|
| 🤖 **ML Deal Scoring** | Random Forest model predicts the probability of each deal closing — calibrated on your own historical data |
| 🧠 **LLM Recommendations** | Multi-LLM architecture (Groq Llama 3.3 70B + Grok xAI) generates personalized **Arabic-first** (with English mirror) "Next Best Action" per deal |
| 📱 **WhatsApp Automation** | Urgent deals trigger automated WhatsApp alerts to the assigned sales rep via Baileys (no API cost) |
| 📊 **Intelligent Dashboard** | React 18 dashboard ranks deals by AI score, shows risk flags, delta badges (▲/▼ vs ML base), and priority tiers |
| 🔄 **Automated Follow-ups** | APScheduler checks deferred follow-ups every 60 minutes and escalates time-sensitive deals |
| 🔐 **Secure Auth** | JWT-based login, Google OAuth SSO, and WhatsApp OTP verification for sales team onboarding |
| 🐳 **Full Docker Stack** | Production-ready 4-service Docker Compose stack — one command to launch everything |

### 🎯 The Core Problem We Solve

Sales managers in the MENA region manage 30–100+ active deals simultaneously across a CRM that shows everyone the same "stage" view. They cannot prioritize effectively — they rely on gut feel, and critical deals fall through the cracks.

**AI CRM Brain gives every sales manager a private AI analyst** that:
1. Reads all active deals from Zoho CRM
2. Scores each deal closure probability using a trained ML model
3. Enriches that score with contextual reasoning using an LLM (deal amount, stage, custom fields, competitor presence, budget status)
4. Delivers a bilingual action recommendation directly to the rep's WhatsApp
5. Tracks the follow-up loop back to the database for model improvement

---

## 💡 Value Proposition

- ✅ **Predicts deal closure probability** using a Random Forest classifier trained on historical Zoho deal data
- ✅ **Generates bilingual recommendations** in Arabic (primary) and English — a 2–3 sentence actionable next step per deal
- ✅ **Automates follow-up scheduling** — deals scoring ≥90% get flagged as "immediate action required"; others deferred with a customizable timer (1–90 days)
- ✅ **Sends WhatsApp messages** — rep alerts via Baileys + AI-crafted client outreach via Grok (xAI) with Groq as fallback
- ✅ **Idempotent data pipeline** — every Zoho sync is safe to re-run without creating duplicates
- ✅ **Risk flagging** — LLM identifies `HIGH_RISK`, `STALLED`, `COMPETITOR_PRESENT`, `BUDGET_UNCERTAIN`, or `NONE` states

### Business Impact

> A sales team managing a $5M pipeline where the average deal is $50K can miss 10–15% of closable deals due to poor prioritization. Improving closure rate by just **+5% through better AI-assisted prioritization** directly translates to **$250,000+ in recovered revenue** — without adding headcount.

---

## 🛠 Technology Stack

### Backend
| Tool | Version | Purpose |
|---|---|---|
| **Python** | 3.11+ | Primary language |
| **FastAPI** | 0.109 | REST API framework (10 routers) |
| **Uvicorn** | 0.27 | ASGI server |
| **SQLAlchemy** | 2.0 | ORM — all database access |
| **Alembic** | 1.13 | Database migration management |
| **Pydantic v2** | 2.x | Request/response validation + settings |
| **APScheduler** | 3.10 | Background follow-up scheduler (60-min interval) |
| **scikit-learn** | 1.4 | Random Forest ML model |
| **joblib** | 1.3 | Model serialisation (.pkl files) |
| **pandas / numpy** | 2.2 / 1.26 | Feature engineering pipeline |

### AI / LLM Layer
| Tool | Purpose |
|---|---|
| **Groq API** (Llama 3.3 70B) | Primary LLM — recommendation generation |
| **Grok API** (xAI — grok-3-latest) | WhatsApp message generation (Groq fallback) |
| **OpenRouter** | Alternative LLM gateway (free-tier models) |
| **LangChain** | LLM chain orchestration |
| **Tenacity** | Retry logic with exponential backoff on LLM rate limits |

### Frontend
| Tool | Version | Purpose |
|---|---|---|
| **React** | 18 | UI framework |
| **TypeScript** | 5.2 | Type-safe frontend code |
| **Vite** | 5.0 | Build tool and dev server |
| **TailwindCSS** | 3.3 | Utility-first styling |
| **TanStack Query** | 5 | Server-state management and caching |
| **Recharts** | 2.10 | Data visualisation (charts, sparklines) |
| **Axios** | 1.6 | HTTP client (API calls to FastAPI) |
| **React Router** | 6 | Client-side routing |
| **Nginx** | alpine | Static file serving (production Docker) |

### WhatsApp Microservice
| Tool | Purpose |
|---|---|
| **Node.js 18** | Runtime |
| **@whiskeysockets/baileys** | WhatsApp Web API (no API cost, QR-code auth) |
| **Express** | HTTP server for microservice API |
| **pino** | Structured logging |
| **qrcode / qrcode-terminal** | QR code generation for WhatsApp pairing |

### Infrastructure and DevOps
| Tool | Purpose |
|---|---|
| **Docker** | Container runtime |
| **Docker Compose** | Multi-container orchestration |
| **PostgreSQL 16** | Primary database |
| **pgAdmin 4** | Database management UI |
| **python-jose** | JWT token creation and verification |
| **passlib[bcrypt]** | Password hashing |
| **google-auth** | Google OAuth 2.0 SSO |
| **python-dotenv** | .env file loading |
| **Twilio SDK** | SMS / WhatsApp backup channel |

---

## 🏗 System Architecture

### Production Docker Stack

```
+--------------------------------------------------------------+
|                   HOST MACHINE (Windows/Linux)               |
|                                                              |
|  +----------------------------------------------------------+|
|  |              Docker Compose Network                       ||
|  |                                                          ||
|  |  +-------------+    +------------------------------+    ||
|  |  |  frontend   |    |           api                |    ||
|  |  |  nginx:alpin|    |   python:3.11-slim           |    ||
|  |  |  Port 80    +--->+   FastAPI + Uvicorn :8000    |    ||
|  |  +-------------+    +-------------+----------------+    ||
|  |                                   |                      ||
|  |  +-------------+    +-------------v----------------+    ||
|  |  | whatsapp_   |    |           db                 |    ||
|  |  | service     |    |   postgres:16                |    ||
|  |  | node:18     |    |   :5432 (internal)           |    ||
|  |  | Port 3000   |    |   :5433 (host-mapped)        |    ||
|  |  +-------------+    +------------------------------+    ||
|  +----------------------------------------------------------+|
+--------------------------------------------------------------+
```

### How the Three Layers Interact

```
+------------------------------------------------------------------+
|                  REACT FRONTEND (Port 80 / 5173)                  |
|      Axios HTTP calls -> FastAPI -> PostgreSQL -> Back to UI       |
+------------------------------------------------------------------+
                              ^ v REST/JSON
+------------------------------------------------------------------+
|                  FASTAPI BACKEND (Port 8000)                      |
|  10 Controllers (routers) -> Models (schema/ML/AI) -> Services   |
|  APScheduler runs follow-up checks every 60 minutes              |
+------------------------------------------------------------------+
                              ^ v SQLAlchemy ORM
+------------------------------------------------------------------+
|                POSTGRESQL 16 (Port 5432/5433)                    |
|  8 Tables: users, otp_codes, zoho_deals, ml_predictions          |
|  llm_recommendations, deal_followups, followup_logs,             |
|  notifications                                                   |
+------------------------------------------------------------------+
                              ^ v Baileys WebSocket
+------------------------------------------------------------------+
|              WHATSAPP MICROSERVICE (Port 3000)                   |
|  Node.js + Baileys — QR auth session in auth_sessions/           |
+------------------------------------------------------------------+
```

---

## 📁 Project Structure

```
AI-CRM-Brain/
|
+-- app.py                          # FastAPI entry point — registers all 10 routers
+-- config.py                       # Pydantic settings — reads all vars from .env
+-- requirements.txt                # Python dependencies (pinned versions)
+-- alembic.ini                     # Alembic migration configuration
|
+-- Dockerfile.backend              # python:3.11-slim image for the API
+-- docker-compose.yaml             # PostgreSQL 16 + pgAdmin 4 (dev only)
+-- docker-compose.prod.yml         # Full 4-service production stack
+-- .dockerignore                   # Keeps Docker build context lean
|
+-- controllers/                    # MVC: The "C" Layer — HTTP routers
|   +-- ingestion_controller.py     # POST /ingest/deals, /ingestion/upload
|   +-- ml_controller.py            # POST /ml/predict, /predict/batch
|   +-- recommendation_controller.py# POST /recommendations/generate
|   +-- dashboard_controller.py     # GET /deals, /summary, /deals/{id}
|   +-- auth_controller.py          # POST /login, /signup, /verify-otp, /google
|   +-- action_controller.py        # POST /actions/actioned, /escalate
|   +-- followup_controller.py      # POST /followups, /generate-message, /send-alert
|   +-- notification_controller.py  # GET/POST /notifications
|   +-- analytics_controller.py     # GET /analytics/* endpoints
|   +-- team_controller.py          # GET/POST /team
|
+-- models/                         # MVC: The "M" Layer — data and ML
|   +-- schema.py                   # SQLAlchemy ORM: 8 table definitions
|   +-- database.py                 # SessionLocal + Base engine (DB_HOST env-aware)
|   +-- api_schemas.py              # Pydantic request/response schemas
|   +-- data_ingestion/
|   |   +-- zoho_api.py             # OAuth token refresh + fetch_deals_schema()
|   +-- ml_engine/
|   |   +-- inference.py            # preprocess_new_deal() + predict_batch()
|   |   +-- data_fusion.py          # fuse_deal_payload() — combines ML + deal context
|   +-- ai_agents/
|       +-- recommender.py          # LLMRecommenderService — multi-LLM + retry
|       +-- prompts.py              # build_llm_prompt() + PROMPT_VERSION
|
+-- services/                       # Business logic (used by controllers)
|   +-- deal_classifier.py          # classify_all_deals() — triggered after sync
|   +-- followup_scheduler.py       # check_deferred_followups() — APScheduler job
|   +-- notification_service.py     # evaluate_and_notify() + send_whatsapp_otp()
|
+-- utils/
|   +-- security.py                 # bcrypt hashing, JWT create/verify
|   +-- whatsapp_sender.py          # WhatsApp sending wrapper
|
+-- frontend/                       # MVC: The "V" Layer — React 18 app
|   +-- src/                        # TypeScript source code
|   +-- Dockerfile.frontend         # Multi-stage: node:18-alpine -> nginx:alpine
|   +-- vite.config.ts
|   +-- tailwind.config.js
|   +-- package.json                # React 18 + TanStack Query + Recharts + Axios
|
+-- whatsapp-microservice/          # Baileys Node.js WhatsApp bridge
|   +-- server.js                   # Express API + Baileys socket handler
|   +-- Dockerfile.whatsapp         # node:18-alpine image
|   +-- auth_sessions/              # QR auth session (volume-mounted in Docker)
|   +-- package.json
|
+-- weights/
|   +-- random_forest_v1.pkl        # Trained Random Forest model (15 MB)
|
+-- artifacts/
|   +-- standard_scaler.pkl         # Fitted StandardScaler
|   +-- feature_columns.json        # FEATURE_COLS + stage_mapping + freq maps
|   +-- label_encoder_stage.pkl     # Stage label encoder
|
+-- scripts/                        # One-off maintenance and utility scripts
|   +-- init_db.py                  # Database initialisation helper
|   +-- create_manager.py           # Seed a manager user account
|   +-- cleanup_duplicate_users.py  # Data hygiene scripts
|   +-- ...
|
+-- alembic/                        # Database migration history
+-- tests/                          # pytest test suite
+-- notebooks/                      # EDA, feature engineering, model training
+-- .env                            # Secret keys (NOT committed to git)
```

---

## 🔍 How It Works — Behind the Scenes

### 📥 When you click "Sync Now"

```
User clicks "Sync Now" in React dashboard
        |
1. React -> POST /api/v1/ingest/deals
        |
2. ingestion_controller.py
   +-- Calls zoho_api.fetch_deals_schema()
   |    +-- Refreshes OAuth access_token using refresh_token
   |    +-- GET https://www.zohoapis.com/crm/v3/Deals (paginated)
   +-- Collects all Contact IDs from deal objects
   +-- Calls fetch_contacts_by_ids() -> enriches with phone + email
   +-- Flattens each nested JSON deal into a flat dict
   +-- INSERT ... ON CONFLICT(id) DO UPDATE -> PostgreSQL zoho_deals
        |
3. After successful upsert:
   +-- classify_all_deals(db) runs automatically
   +-- Returns: { status, records_processed, classification }
```

### 🤖 When you click "Generate AI Recommendations"

```
POST /api/v1/recommendations/generate
        |
-- PHASE 1: ML Scoring --
1. Find all zoho_deals WITHOUT a matching ml_prediction row
2. inference.preprocess_new_deal(raw_deals)
   +-- Date engineering: Close_Year, Close_Month, Close_Quarter, Deal_Age_Days
   +-- Frequency encoding: Owner_Freq, Account_Freq (from feature_columns.json)
   +-- StandardScaler.transform() -> scaled feature matrix X
3. inference.predict_batch(X)
   +-- rf_model.predict_proba(X) -> probabilities for all 4 stage classes
   +-- base_probability = class[3] probability ("Won") x 100
4. INSERT ... ON CONFLICT(deal_id) DO UPDATE -> ml_predictions table

-- PHASE 2: LLM Recommendations --
5. Find all ml_predictions WITHOUT a matching llm_recommendation row
6. data_fusion.fuse_deal_payload(db, prediction)
   +-- Combines: base_probability + stage + amount + closing_date
               + owner_name + account_name + custom_fields (JSONB)
7. recommender.generate_recommendation(fused_payload)
   +-- prompts.build_llm_prompt() -> few-shot messages[]
   +-- Primary: Groq API (llama-3.3-70b-versatile), response_format=json_object
   +-- Fallback: Grok API (xAI -- grok-3-latest)
   +-- Tenacity retry (3 attempts, exponential backoff on RateLimitError)
   +-- Pydantic validate: LLMRecommendationOutput
   +-- Returns: {adjusted_probability, recommendation_ar, recommendation_en,
                risk_flag, risk_reasoning}
8. INSERT ... ON CONFLICT(deal_id, batch_id) DO UPDATE -> llm_recommendations
9. Urgency check:
   +-- IF (amount >= $50K AND adj_prob < 45%) OR risk_flag=HIGH_RISK -> URGENT
   +-- BackgroundTask: evaluate_and_notify() -> WhatsApp alert to rep
```

### 📋 When you click "Follow Up" on a deal

```
POST /api/v1/followups/{deal_id}/generate-message
        |
1. Fetch deal + latest LLM recommendation (AI score)
2. Build Grok prompt with deal context
3. Call Grok API (xAI) -> grok-3-latest -> personalized WhatsApp message
   +-- If Grok fails -> fallback to Groq (Llama 3.3 70B)
        |
POST /api/v1/followups/{deal_id}/send-alert
        |
4. Look up rep verified phone number in users table
5. Build formatted alert message with deal link, AI score, urgency
6. Baileys WhatsApp microservice -> sends to rep WhatsApp
        |
POST /api/v1/followups/{deal_id}/mark
        |
7. Creates FollowupLog record (channel, message_sent, notes)
8. Sets deal.action_status = "followed_up"
9. Creates in-app Notification for the deal owner
```

---

## 🐳 Running with Docker (Recommended)

This is the **recommended way to run the full production stack** — one command starts all 4 services.

### Prerequisites

- [Docker Desktop](https://docs.docker.com/get-docker/) installed and running
- Your `.env` file configured (see [Environment Variables](#-environment-variables))

---

### Step 1 — Clone the Repository

```bash
git clone https://github.com/YOUR_ORG/AI-CRM-Brain.git
cd AI-CRM-Brain
```

---

### Step 2 — Configure `.env`

```bash
cp .env.example .env
# Edit .env with your API keys and credentials
```

---

### Step 3 — Build and Launch All Services

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

This builds and starts 4 containers:

| Container | Image | Port |
|---|---|---|
| `db` | `postgres:16` | `5433` (host) |
| `api` | `python:3.11-slim` | `8000` |
| `frontend` | `nginx:alpine` | `80` |
| `whatsapp_service` | `node:18-alpine` | `3000` |

> **First build takes 5–15 minutes.** Subsequent builds are fast thanks to Docker layer caching.

---

### Step 4 — Verify All Services Are Healthy

```bash
docker compose -f docker-compose.prod.yml ps
```

Expected output:
```
NAME                              STATUS
ai-crm-brain-db-1                 Up (healthy)
ai-crm-brain-api-1                Up (healthy)
ai-crm-brain-frontend-1           Up
ai-crm-brain-whatsapp_service-1   Up
```

> If `api` shows `Restarting`, wait 60 seconds and check again — it has a 40s `start_period` healthcheck.

---

### Step 5 — Run Database Migrations (First Time Only)

```bash
docker compose -f docker-compose.prod.yml exec api alembic upgrade head
```

---

### Step 6 — Pair WhatsApp (First Time Only)

```bash
docker compose -f docker-compose.prod.yml logs whatsapp_service
```

Scan the QR code in the logs with your phone: **WhatsApp → Linked Devices → Link a Device**

> The session is saved to `whatsapp-microservice/auth_sessions/` (volume-mounted). You will **never need to scan again** after the first time.

---

### Step 7 — Access the Application

| Service | URL | Notes |
|---|---|---|
| 🖥️ **Frontend** | http://localhost | Main React dashboard |
| ⚙️ **API** | http://localhost:8000 | FastAPI backend |
| 📖 **API Docs** | http://localhost:8000/docs | Interactive Swagger UI |
| 💬 **WhatsApp Service** | http://localhost:3000 | Microservice status |
| 🗄️ **pgAdmin** | http://localhost:5050 | Database management UI |

---

### Docker Management Commands

```bash
# View live logs for all services
docker compose -f docker-compose.prod.yml logs -f

# View logs for one service only
docker compose -f docker-compose.prod.yml logs -f api

# Restart a single service after a code change
docker compose -f docker-compose.prod.yml restart api

# Rebuild and restart one service only
docker compose -f docker-compose.prod.yml up --build -d api

# Stop everything (data is preserved in the pgdata volume)
docker compose -f docker-compose.prod.yml down

# Stop AND wipe the database volume (irreversible)
docker compose -f docker-compose.prod.yml down -v

# Clean up orphan containers from the old docker-compose.yaml
docker compose -f docker-compose.prod.yml up -d --remove-orphans
```

---

## 💻 Running Locally (Development)

Use this method for hot-reload during active development.

### Prerequisites

- **Python 3.11+**
- **Node.js 18+** and npm
- **Docker Desktop** (for PostgreSQL only)

---

### Step 1 — Clone and Set Up Python Environment

```bash
git clone https://github.com/YOUR_ORG/AI-CRM-Brain.git
cd AI-CRM-Brain

# Conda (recommended)
conda create -n ai-crm-brain python=3.11 -y
conda activate ai-crm-brain

# OR: venv
python -m venv .venv
source .venv/bin/activate        # macOS/Linux
.venv\Scripts\activate           # Windows
```

### Step 2 — Install Python Dependencies

```bash
pip install -r requirements.txt
```

### Step 3 — Configure `.env`

```bash
cp .env.example .env
# Set DB_PORT=5433. Leave DB_HOST unset (it defaults to localhost).
```

### Step 4 — Start PostgreSQL Only

```bash
docker compose up -d
```

### Step 5 — Run Database Migrations

```bash
alembic upgrade head
```

### Step 6 — Start the FastAPI Backend

```bash
python app.py
# OR
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

Verify: `curl http://localhost:8000/health` returns `{"status": "online"}`

### Step 7 — Start the React Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

### Step 8 — Start the WhatsApp Microservice

```bash
cd whatsapp-microservice
npm install
node server.js
```

Scan the QR code with your WhatsApp app.

---

## 📡 API Reference

All endpoints are prefixed with `/api/v1`. Full interactive docs at `http://localhost:8000/docs`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health check |
| **Ingestion** | | |
| `POST` | `/ingest/deals` | Full Zoho CRM pull and upsert to PostgreSQL |
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
| `POST` | `/auth/login` | Email/password login returns JWT |
| `POST` | `/auth/signup` | Register and send WhatsApp OTP |
| `POST` | `/auth/verify-otp` | Verify OTP and activate account |
| `POST` | `/auth/google` | Google OAuth SSO returns JWT |
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
| **Analytics** | | |
| `GET` | `/analytics/*` | KPI analytics endpoints |
| **Team** | | |
| `GET` | `/team` | List team members |
| `POST` | `/team` | Add team member |

---

## 🔑 Environment Variables

Create a `.env` file in the project root using `.env.example` as the template.

```dotenv
# Zoho CRM
ZOHO_CLIENT_ID=your_zoho_client_id
ZOHO_CLIENT_SECRET=your_zoho_client_secret
SCOPE_NAME=ZohoCRM.modules.deals.READ,ZohoCRM.modules.contacts.READ,ZohoCRM.modules.accounts.READ
ZOHO_REFRESH_TOKEN=your_zoho_refresh_token

# PostgreSQL
POSTGRES_USER=your_db_user
POSTGRES_PASSWORD=your_db_password
DB_NAME=ai_crm_brain
DB_PORT=5433
# DB_HOST is set automatically to "db" inside Docker. Leave unset for local dev.

# pgAdmin
PGADMIN_EMAIL=admin@example.com
PGADMIN_PASSWORD=your_pgadmin_password

# LLM: Groq (Primary)
LLM_API_KEY=gsk_your_groq_api_key
LLM_PROVIDER=groq
LLM_MODEL_ID=llama-3.3-70b-versatile
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MAX_TOKENS=2000
LLM_TEMPERATURE=0.3

# LLM: Grok / xAI (WhatsApp Message Generation)
GROK_API_KEY=xai_your_grok_api_key
GROK_BASE_URL=https://api.x.ai/v1
GROK_MODEL=grok-3-latest

# Auth and Security
SECRET_KEY=your_random_64_char_hex_secret
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# App Settings
APP_BASE_URL=http://localhost:5173
API_BASE_URL=http://localhost:8000
BATCH_INTERVAL_MINUTES=30

# Twilio (backup WhatsApp/SMS channel)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WHATSAPP_NUMBER=+14155238886

# SMTP (Email notifications)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password
```

> 🔐 **Never commit `.env` to git.** It is listed in `.gitignore`.

---

## 🗄 Database Schema

The system uses **8 PostgreSQL tables** forming a clear processing pipeline:

```
users
otp_codes (FK -> users)

zoho_deals
    |
    +---> ml_predictions
    |           |
    |           +---> llm_recommendations
    |
    +---> deal_followups
    +---> followup_logs
    +---> notifications
```

| Table | Purpose |
|---|---|
| `users` | Sales reps/managers — hashed password, role, phone, WhatsApp verification status |
| `otp_codes` | 6-digit OTPs for WhatsApp phone verification during signup |
| `zoho_deals` | Source of truth for all deal data — raw fields + enriched contact info |
| `ml_predictions` | Random Forest output — base_probability, confidence_all_classes, batch_id |
| `llm_recommendations` | LLM output — adjusted_probability, recommendation_ar, recommendation_en, risk_flag, priority_tier, score_delta |
| `deal_followups` | Scheduling table — immediate or deferred follow-up with timestamp |
| `followup_logs` | Audit log of every completed follow-up action |
| `notifications` | In-app notification inbox per user |

---

## 🗺 Future Roadmap

### Phase 2 — Expanding CRM Integrations (Q3 2026)
- **HubSpot CRM Connector** — Mirror the Zoho pipeline with HubSpot REST API v3
- **Salesforce Integration** — OAuth 2.0 + Salesforce REST API connector

### Phase 3 — Domain-Specific AI Models (Q4 2026)
- **Real Estate Module** — Custom model weights for property deals
- **Automotive Module** — Specialized model for car dealership pipelines
- **Custom Model Upload** — Teams upload labeled data to retrain the ML model without code

### Phase 4 — Conversational AI (Q1 2027)
- **RAG-Based Business Chatbot** — Natural language queries over the live database
- **Knowledge Base Integration** — Index company playbooks, product specs, and pricing sheets

### Phase 5 — Full Automation (Q2 2027)
- **WhatsApp AI Agent** — Fully autonomous agent that can hold client conversations
- **Multi-Channel Outreach** — Email (SendGrid), SMS (Twilio), WhatsApp with channel-appropriate message formats

### Phase 6 — Standalone CRM Platform (2027+)
- **AI CRM Brain becomes the CRM itself** — Full pipeline management without Zoho
- **Enterprise SSO** — SAML/OIDC in addition to existing Google OAuth
- **Team Analytics** — Rep-level performance: closure rate, follow-up-to-close time, recommendation acceptance rate

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make changes and add tests in `tests/`
4. Run tests: `pytest tests/ -v`
5. Submit a Pull Request with a clear description

### Code Style

- Python: PEP 8; type hints on all function signatures
- FastAPI: every endpoint must have a docstring and proper response model
- Database: all schema changes go through Alembic — never `ALTER TABLE` directly
- Docker: rebuild the specific service only (`--build api`) to avoid unnecessary rebuilds

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

Built with love for the MENA sales community

FastAPI · PostgreSQL 16 · Random Forest · Groq (Llama 3.3 70B) · Grok xAI · React 18 · Baileys · Docker · Nginx · Alembic
