import psycopg2
import socket

def test_sni():
    # Resolve the pooler IP address
    pooler_host = "aws-0-ap-southeast-1.pooler.supabase.com"
    try:
        pooler_ip = socket.gethostbyname(pooler_host)
        print(f"Resolved pooler IP: {pooler_ip}")
    except Exception as e:
        print(f"Failed to resolve pooler IP: {e}")
        return

    db_host = "db.cypbnnohtipwavcwukhl.supabase.co"
    user = "postgres"  # Standard username, not postgres.project-ref
    db = "postgres"
    password = "munifpaisedega"
    
    # Try both 5432 and 6543
    for port in [5432, 6543]:
        print(f"\nTesting port {port} with hostaddr and SNI...")
        try:
            conn = psycopg2.connect(
                host=db_host,
                hostaddr=pooler_ip,
                database=db,
                user=user,
                password=password,
                port=port,
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
                
            print("\nChecking if RLS is enabled on 'products' table...")
            cur.execute("SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'products';")
            row = cur.fetchone()
            if row:
                print(f"Table: {row[0]} | Row Security Enabled: {row[1]}")
                
            cur.close()
            conn.close()
            return
        except Exception as e:
            print(f"Port {port} failed: {e}")

if __name__ == "__main__":
    test_sni()
