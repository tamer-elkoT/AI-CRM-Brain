
##  Development Workflow

Follow these steps to resume development on the **AI CRM Brain** after restarting your machine.

### 1. Launch the Infrastructure

Open your terminal (WSL) in the project root directory and start the Docker containers:

```bash
# Start PostgreSQL and pgAdmin sin the background
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

---

### Pro-Tip for your `README.md`

To keep this looking professional, add a **"Status"** or **"Troubleshooting"** subsection below this workflow that briefly mentions:

* *If the container fails to start, verify that Docker Desktop is running on your Windows host.*
* *If you encounter database connection issues, ensure the containers are in a "Running" state by checking `docker ps`.*



### 2. How to run this exact request in Postman

To replicate this exact API pull in Postman (which is great for quickly testing if a field exists before adding it to your Python script), follow these steps:

**Step 1: Get a fresh Access Token**
Run your Python script one time and copy the fresh token it prints out to your terminal (e.g., `1000.xxxxxxxxx...`).

**Step 2: Setup the Postman Request**

1. Open Postman and create a new request.
2. Change the method dropdown to **GET**.
3. Paste the URL into the address bar:
`https://www.zohoapis.com/crm/v3/Deals` *(Use .eu or .in if your account is outside the US)*.

**Step 3: Add the Query Parameters**
We want to mimic your `params = {'fields': '...'}` code.

1. Click the **Params** tab (right below the URL bar).
2. Under "Key", type: `fields`
3. Under "Value", paste your exact list: `Deal_Name,Amount,Stage,Closing_Date,Probability,Expected_Revenue,Account_Name,Contact_Name,Owner`

**Step 4: Add your Authentication**

1. Click the **Headers** tab.
2. Under "Key", type: `Authorization`
3. Under "Value", type: `Zoho-oauthtoken ` followed by a space, and then paste the access token you copied in Step 1.
*(Example: `Zoho-oauthtoken 1000.abcdefg123456...`)*

**Step 5: Hit Send!**
Click the blue **Send** button. In the lower half of Postman, you will see the exact same JSON response that your Python script just processed!


# To Generate a New Migration using Alembic (Commit the changes)
In your terminal, inside your project folder, run the command that tells Alembic to detect the change:

```bash

alembic revision --autogenerate -m "add account_name to zoho_deals"
```
. Apply the Migration
After running that, Alembic will have created a new file in your alembic/versions/ folder. Review it to ensure it looks correct, then apply it:

``` bash 

alembic upgrade head
```