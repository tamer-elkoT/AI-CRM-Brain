
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