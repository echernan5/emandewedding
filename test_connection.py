import psycopg2

# This is the full connection string from your Supabase dashboard
# Paste the string for the Session Pooler here
DATABASE_URL = "postgresql://postgres.ktftyablznehogjqaaxs:O0868s40xSAJbj6I@aws-1-us-east-1.pooler.supabase.com:5432/postgres"

def test_db_connection():
    try:
        print("Attempting to connect to the database...")
        conn = psycopg2.connect(DATABASE_URL)
        print("Success! Connection to the database was successful.")
        conn.close()
    except Exception as e:
        print("Failed to connect to the database.")
        print("Error:", e)

if __name__ == "__main__":
    test_db_connection()