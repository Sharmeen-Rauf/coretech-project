import urllib.parse
import psycopg2

def run_query():
    host = "aws-0-ap-southeast-1.pooler.supabase.com"
    db = "postgres"
    # URL encode the user
    user = urllib.parse.quote_plus("postgres.cypbnnohtipwavcwukhl")
    password = "munifpaisedega"
    db_url = f"postgresql://{user}:{password}@{host}:6543/{db}?sslmode=require"
    
    print(f"Connecting to database using pooler...")
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # Query policies
        print("Querying RLS policies for 'products' table...")
        cur.execute("SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'products';")
        rows = cur.fetchall()
        for row in rows:
            print(f"Policy: {row[2]} | Permissive: {row[3]} | Roles: {row[4]} | Cmd: {row[5]} | Qual: {row[6]} | WithCheck: {row[7]}")
            
        # Also, check if RLS is enabled on products
        print("\nChecking if RLS is enabled on 'products' table...")
        cur.execute("SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'products';")
        row = cur.fetchone()
        if row:
            print(f"Table: {row[0]} | Row Security Enabled: {row[1]}")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    run_query()
