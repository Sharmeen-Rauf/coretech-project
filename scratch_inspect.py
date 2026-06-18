import os
import psycopg2

def main():
    db_url = "postgresql://postgres:munifpaisedega@db.cypbnnohtipwavcwukhl.supabase.co:5432/postgres"
    conn = psycopg2.connect(db_url)
    cursor = conn.cursor()
    
    # Query column names and data types for installer_jobs
    cursor.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'installer_jobs' AND table_schema = 'public';
    """)
    columns = cursor.fetchall()
    print("Columns in installer_jobs:")
    for col in columns:
        print(f" - {col[0]} ({col[1]})")
        
    cursor.close()
    conn.close()

if __name__ == '__main__':
    main()
