import psycopg2

def main():
    # Construct pooler URL for Singapore region (ap-southeast-1)
    db_url = "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require"
    
    print("Connecting to Singapore database pooler...")
    conn = psycopg2.connect(db_url)
    cursor = conn.cursor()
    
    print("Executing ALTER TABLE statements...")
    
    # Add columns if not exists
    queries = [
        "ALTER TABLE installer_jobs ADD COLUMN IF NOT EXISTS serial_number text;",
        "ALTER TABLE installer_jobs ADD COLUMN IF NOT EXISTS remarks text;",
        "ALTER TABLE installer_jobs ADD COLUMN IF NOT EXISTS incentive numeric;"
    ]
    
    for query in queries:
        try:
            print(f"Running: {query}")
            cursor.execute(query)
            conn.commit()
            print("Done.")
        except Exception as e:
            conn.rollback()
            print(f"Failed to execute query: {e}")
            
    cursor.close()
    conn.close()
    print("Migration complete!")

if __name__ == '__main__':
    main()
