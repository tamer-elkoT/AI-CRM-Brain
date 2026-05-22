This is the consolidated, professional `README.md` for the **AI CRM Brain** repository. It captures all your environment setup, developer workflows, and the updated 6-Sprint roadmap.

You can copy and save this content directly into your `README.md` file.

---

# 🧠 AI CRM Brain

**AI CRM Brain** is an intelligent layer built on top of traditional CRMs (starting with Zoho CRM). It transforms static data into an actionable decision-making engine by combining **XGBoost predictive modeling** (to calculate deal closure probability) with **Large Language Models (LLMs)** (to generate human-readable "Next Best Actions" for sales reps).

---

## 🛠️ Technology Stack

* **Architecture:** MVC (Model-View-Controller)
* **Backend:** Python 3.10+, FastAPI
* **Machine Learning:** Scikit-Learn, XGBoost, SHAP
* **Generative AI:** OpenAI / LangChain (Few-Shot Prompting)
* **Database:** PostgreSQL 16 (via Docker) + Alembic Migrations
* **Frontend:** Streamlit

---

## 🚀 Development Workflow

Follow these steps to resume development on the AI CRM Brain after restarting your machine.

### 1. Launch the Infrastructure

Open your terminal (WSL) in the project root directory and start the Docker containers:

```bash
# Start PostgreSQL and pgAdmin in the background
docker-compose up -d

```

### 2. Access the Database

You can manage your data using the web-based pgAdmin interface:

1. Open your browser and navigate to: `http://localhost:5050`
2. **Login:** Use the `PGADMIN_EMAIL` and `PGADMIN_PASSWORD` defined in your `.env` file.
3. **Connect:** Use the server registered as `AI CRM Web DB` (or register a new one using host: `db`, port: `5432`).

### 3. Activate the Environment

Before running any Python scripts or notebooks, activate your Conda environment:

```bash
conda activate ai_crm_brain

```

### 4. Resuming Work

* **To run the Data Analysis:** Navigate to the `notebooks/` directory and open `data_exploration.ipynb` in VS Code or Jupyter Lab.
* **To run the Application:** Execute the main entry point:

```bash
python app.py

```

> **Note:** You do **not** need to re-run `init_db.py` or `insert_sql.py` unless you want to reset your database to its initial state. Your data is persisted in the Docker volume.

### 5. Troubleshooting

* *If the container fails to start:* Verify that Docker Desktop is running on your Windows host.
* *If you encounter database connection issues:* Ensure the containers are in a "Running" state by checking `docker ps`.

---

## 🗄️ Database Migrations (Alembic)

When you make changes to the database schema in your SQLAlchemy models, you must generate and apply an Alembic migration.

**1. Generate a New Migration:**

```bash
alembic revision --autogenerate -m "describe_your_change_here"

```

**2. Apply the Migration:**
Review the generated file in `alembic/versions/` to ensure it is correct, then apply it:

```bash
alembic upgrade head

```

---

## 🌐 API Testing (Postman)

To replicate the Zoho API pull in Postman (useful for testing if a field exists before adding it to the Python script):

1. **Get a fresh Access Token:** Run your Python script once and copy the fresh token it prints out.
2. **Setup Request:** Create a new `GET` request in Postman targeting `https://www.zohoapis.com/crm/v3/Deals`.
3. **Add Query Parameters:** Under the Params tab, add Key: `fields` and Value: `Deal_Name,Amount,Stage,Closing_Date,Probability,Expected_Revenue,Account_Name,Contact_Name,Owner`.
4. **Add Authentication:** Under the Headers tab, add Key: `Authorization` and Value: `Zoho-oauthtoken [YOUR_TOKEN_HERE]`.
5. **Send:** Click Send to view the exact JSON response.

---

## 🗺️ Master Execution Roadmap (MVP v1.0)

*This project follows a strict 6-week sprint cycle focused exclusively on the Zoho Deals module.*

### ✅ Sprint 1: Foundation & API Setup

* **Focus:** Understanding CRM data structures and establishing the integration layer.
* **Deliverables:**
* Initialized MVC repository structure.
* Successful OAuth 2.0 flow.
* PostgreSQL + pgAdmin Docker setup.
* Migration scripts for: `zoho_deals`, `ml_predictions`, `llm_recommendations`.



### 🔄 Sprint 2: Data Preprocessing & Pipeline (Current)

* **Focus:** Transforming raw CRM data into a clean mathematical format.
* **Deliverables:**
* Exploratory Data Analysis (EDA) report.
* Data cleaning logic (Null handling, categorical encoding, feature engineering).
* Train/Validation/Test split implemented to prevent data leakage.
* `feature_columns.json` (artifacts mapping).



### 📅 Sprint 3: Predictive Modeling (ML Engine)

* **Focus:** Building the core algorithm to predict Deal Closure probability.
* **Deliverables:**
* Baseline XGBoost/Random Forest model training.
* Hyperparameter tuning (Validation set).
* Model evaluation report (AUC-ROC, F1-Score).
* Saved production-ready model artifact (`model.pkl`).



### 📅 Sprint 4: Recommendation Engine (Generative AI)

* **Focus:** Translating probabilities into actionable advice.
* **Deliverables:**
* OpenAI / LangChain API integration.
* "Few-Shot" Prompt Engineering template.
* Feature Vector parsing (SHAP values to LLM context).
* Automated population of the `llm_recommendations` table.



### 📅 Sprint 5: UI & Dashboard (View Layer)

* **Focus:** Delivering the interface for the Sales Manager.
* **Deliverables:**
* Streamlit app dashboard.
* PostgreSQL integration (read-only queries).
* Arabic recommendation rendering (RTL support).
* Actionable insight badges and probability progress bars.



### 📅 Sprint 6: Optimization & Demo Prep

* **Focus:** System stability, documentation, and demo.
* **Deliverables:**
* Automated batch-scoring cron job implementation.
* Final code documentation and codebase cleanup.
* Live demo presentation and business case pitch.