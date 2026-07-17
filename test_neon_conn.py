import psycopg2

NEON_URL = "postgresql://neondb_owner:npg_pSEqFHM0R3ba@ep-lingering-meadow-za9fshz6.c-2.eu-west-2.aws.neon.tech/neondb?sslmode=require"

try:
    conn = psycopg2.connect(NEON_URL)
    cur = conn.cursor()
    cur.execute("SELECT version()")
    version = cur.fetchone()[0]
    print(f"SUCCESS (CRM venv): {version}")
    cur.execute("SELECT current_database(), current_user")
    db, user = cur.fetchone()
    print(f"Database: {db}  |  User: {user}")
    conn.close()
except Exception as e:
    print(f"FAILED: {e}")
