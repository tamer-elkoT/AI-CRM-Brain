# AI CRM Brain - Sprint 1: Foundation & API Setup

## 🎯 Sprint Objective
As defined in the project roadmap, the primary goal of Week 1 is: *"Deep understanding of CRM user needs, and research on best practices in predictive sales analytics."* For our updated ML + LLM Hybrid Architecture, this translates into establishing the exact data structures, securing API access, defining the base Machine Learning logic, and setting up the development environment.

---

## 🛠️ Tools & Libraries Required

### Development Tools
* **Git & GitHub/GitLab:** For version control.
* **Postman:** For API testing and exploring the Zoho CRM JSON schema.
* **Zoho CRM Developer Sandbox:** A free environment to test API calls without affecting live data.
* **Python 3.9+:** Core programming language for the backend.

### Python Packages (`requirements.txt`)
* `requests`: To handle API calls to Zoho CRM.
* `pandas`: For data structuring, manipulation, and flattening the JSON responses into dataframes.
* `numpy`: For numerical operations during feature engineering.
* `scikit-learn`: For building the baseline Machine Learning model (e.g., Random Forest or Logistic Regression).
* `openai` (or `anthropic`): To integrate the LLM Agent for the recommendation engine.
* `python-dotenv`: To securely manage API keys and credentials.

---

## 📋 Step-by-Step Task List

### Step 1: Secure the Data Source (Zoho CRM API Setup)
**Goal:** Understand the exact JSON schema that the system will process.
* [ ] **Task 1.1:** Create a free Zoho CRM Developer/Sandbox account.
* [ ] **Task 1.2:** Populate the Sandbox with dummy data (Leads, Deals, Activities).
* [ ] **Task 1.3:** Register a "Self Client" in the Zoho API Console to generate `Client ID`, `Client Secret`, and `Grant Token`.
* [ ] **Task 1.4:** Use Postman or Python to make `GET` requests to `/crm/v3/Deals`, `/crm/v3/Leads`, and `/crm/v3/Activities`.
* [ ] **Task 1.5:** Save the JSON responses locally. Analyze the fixed system `api_names` (e.g., `Amount`, `Stage`).

### Step 2: Define Predictive Analytics Baseline (ML Logic)
**Goal:** Establish the mathematical rules for the initial ML Base Score.
* [ ] **Task 2.1:** Select 4-6 standard, immutable Zoho fields as the ML input features (e.g., `Amount`, `Stage`, `Closing_Date`, `Lead_Source`).
* [ ] **Task 2.2:** Define the Target Variable (e.g., `Stage` == 'Closed Won' is `1`, 'Closed Lost' is `0`).
* [ ] **Task 2.3:** Define "Activity Momentum" rules (e.g., How to calculate the number of days since the last call using the Activities API).

### Step 3: Draft LLM Business Rules (Prompt Engineering)
**Goal:** Create the instructions that translate raw data into natural language recommendations.
* [ ] **Task 3.1:** Write the LLM Persona prompt (e.g., *"You are an AI Sales Strategist..."*).
* [ ] **Task 3.2:** Draft 3 to 5 "Few-Shot" examples demonstrating how the LLM should adjust the ML Base Score when encountering unseen custom fields (e.g., if custom field `Competitor` is present).
* [ ] **Task 3.3:** Define the strict JSON output schema for the LLM (`adjusted_probability` and `recommendation_ar`).

### Step 4: Initialize the Development Environment
**Goal:** Prepare the codebase for Week 2's Data Ingestion Unit development.
* [ ] **Task 4.1:** Initialize the Git repository.
* [ ] **Task 4.2:** Create a Python virtual environment (`python -m venv env`) and activate it.
* [ ] **Task 4.3:** Create a `.env` file to store Zoho and OpenAI API keys (ensure `.env` is added to `.gitignore`).
* [ ] **Task 4.4:** Create `requirements.txt` and install the required libraries (`pip install -r requirements.txt`).
* [ ] **Task 4.5:** Set up the basic folder structure (e.g., `/data_ingestion`, `/models`, `/notebooks` for testing).

---
*End of Sprint 1*
