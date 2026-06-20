import psycopg2

formats = [
    ("postgres.cypbnnohtipwavcwukhl", "postgres"),
    ("postgres@cypbnnohtipwavcwukhl", "postgres"),
    ("cypbnnohtipwavcwukhl.postgres", "postgres"),
    ("postgres", "cypbnnohtipwavcwukhl"),
]

def test_conn(user, db):
    host = "aws-0-ap-southeast-1.pooler.supabase.com"
    try:
        conn = psycopg2.connect(
            host=host,
            database=db,
            user=user,
            password="munifpaisedega",
            port=6543,
            connect_timeout=3
        )
        conn.close()
        return True, "Success!"
    except Exception as e:
        return False, str(e)

def main():
    print("Testing connection formats using parameter dictionary...")
    for user, db in formats:
        print(f"Testing User: '{user}', DB: '{db}'...", end=" ")
        success, msg = test_conn(user, db)
        if success:
            print(" SUCCESS!")
            print(f"Working parameters: host={host} db={db} user={user}")
            return
        else:
            print(f" FAILED: {msg}")

if __name__ == '__main__':
    main()
