import psycopg2

def test_ssl():
    host = "aws-0-ap-southeast-1.pooler.supabase.com"
    user = "postgres.cypbnnohtipwavcwukhl"
    db = "postgres"
    password = "munifpaisedega"
    
    for port in [5432, 6543]:
        print(f"Testing port {port} with sslmode='require'...")
        try:
            conn = psycopg2.connect(
                host=host,
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
            cur.close()
            conn.close()
            return
        except Exception as e:
            print(f"Port {port} failed: {e}")

if __name__ == "__main__":
    test_ssl()
