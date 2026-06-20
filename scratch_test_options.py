import psycopg2

def test_options():
    host = "aws-0-ap-southeast-1.pooler.supabase.com"
    user = "postgres"
    db = "postgres"
    password = "munifpaisedega"
    options = "-c reference=cypbnnohtipwavcwukhl"
    
    for port in [5432, 6543]:
        print(f"Testing port {port} with options='{options}'...")
        try:
            conn = psycopg2.connect(
                host=host,
                database=db,
                user=user,
                password=password,
                port=port,
                options=options,
                sslmode="require",
                connect_timeout=5
            )
            print(f"Port {port} CONNECTED SUCCESSFULLY!")
            
            cur = conn.cursor()
            cur.execute("SELECT version();")
            print("DB Version:", cur.fetchone())
            
            # Query policies on products
            print("\nQuerying RLS policies for 'products' table...")
            cur.execute("SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'products';")
            rows = cur.fetchall()
            for row in rows:
                print(f"Policy: {row[2]} | Permissive: {row[3]} | Roles: {row[4]} | Cmd: {row[5]} | Qual: {row[6]} | WithCheck: {row[7]}")
                
            cur.close()
            conn.close()
            return
        except Exception as e:
            print(f"Port {port} failed: {e}")

if __name__ == "__main__":
    test_options()
