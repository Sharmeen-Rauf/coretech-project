import psycopg2

def test_direct():
    host = "db.cypbnnohtipwavcwukhl.supabase.co"
    try:
        print("Attempting direct connection to db.cypbnnohtipwavcwukhl.supabase.co:5432...")
        conn = psycopg2.connect(
            host=host,
            database="postgres",
            user="postgres",
            password="munifpaisedega",
            port=5432,
            connect_timeout=5
        )
        print("Direct connection successful!")
        
        # Query pg_policies
        cur = conn.cursor()
        print("\nQuerying RLS policies for 'products' table...")
        cur.execute("SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'products';")
        rows = cur.fetchall()
        for row in rows:
            print(f"Policy: {row[2]} | Permissive: {row[3]} | Roles: {row[4]} | Cmd: {row[5]} | Qual: {row[6]} | WithCheck: {row[7]}")
            
        print("\nChecking if RLS is enabled on 'products' table...")
        cur.execute("SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'products';")
        row = cur.fetchone()
        if row:
            print(f"Table: {row[0]} | Row Security Enabled: {row[1]}")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Direct connection failed: {e}")

if __name__ == "__main__":
    test_direct()
