import psycopg2

regions = [
    "ap-southeast-1", # Singapore
    "ap-south-1",     # Mumbai
    "ap-southeast-2", # Sydney
    "ap-northeast-1", # Tokyo
    "ap-northeast-2", # Seoul
    "us-east-1",      # N. Virginia
    "us-east-2",      # Ohio
    "us-west-1",      # N. California
    "us-west-2",      # Oregon
    "eu-west-1",      # Ireland
    "eu-west-2",      # London
    "eu-west-3",      # Paris
    "eu-central-1",   # Frankfurt
    "ca-central-1",   # Central Canada
    "sa-east-1",      # Sao Paulo
]

def test_region(region):
    host = f"aws-0-{region}.pooler.supabase.com"
    user = "postgres.cypbnnohtipwavcwukhl"
    db = "postgres"
    try:
        conn = psycopg2.connect(
            host=host,
            database=db,
            user=user,
            password="munifpaisedega",
            port=6543,
            connect_timeout=2
        )
        conn.close()
        return True, "Success!"
    except Exception as e:
        return False, str(e)

def main():
    print("Scanning Supabase regions for pooler host...")
    for region in regions:
        print(f"Testing region: {region}...", end=" ")
        success, msg = test_region(region)
        if success:
            print(" SUCCESS!!!")
            print(f"Found working pooler: aws-0-{region}.pooler.supabase.com")
            return
        else:
            print(f" FAILED: {msg}")

if __name__ == '__main__':
    main()
