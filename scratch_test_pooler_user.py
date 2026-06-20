import psycopg2

formats = [
    ("postgres.cypbnnohtipwavcwukhl", "postgres"),
    ("postgres@cypbnnohtipwavcwukhl", "postgres"),
    ("cypbnnohtipwavcwukhl.postgres", "postgres"),
    ("postgres", "cypbnnohtipwavcwukhl"),
]

def test_conn(user, db):
    host = "aws-0-ap-southeast-1.pooler.supabase.com"
    db_url = f"postgresql://{user}:munifpaisedega@{host}:6543/{db}?sslmode=require"
    try:
        conn = psycopg2.connect(db_url, connect_timeout=3)
        conn.close()
        return True, "Success!"
    except Exception as e:
        return False, str(e)

def main():
    print("Testing connection formats...")
    for user, db in formats:
        print(f"Testing User: '{user}', DB: '{db}'...", end=" ")
        success, msg = test_conn(user, db)
        if success:
            print(" SUCCESS!")
            print(f"Working connection string: postgresql://{user}:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/{db}")
            return
        else:
            print(f" FAILED: {msg}")

if __name__ == '__main__':
    main()
