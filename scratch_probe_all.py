import psycopg2
import sys

regions = [
    "us-east-1", "us-east-2", "us-west-1", "us-west-2",
    "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2", "ap-south-1",
    "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1",
    "sa-east-1", "ca-central-1"
]

def test_region(region):
    host = f"aws-0-{region}.pooler.supabase.com"
    db_url = f"postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@{host}:6543/postgres?sslmode=require"
    try:
        conn = psycopg2.connect(db_url, connect_timeout=3)
        conn.close()
        return True, "Connected successfully!"
    except Exception as e:
        return False, str(e)

def main():
    with open("scratch_probe_results.txt", "w") as f:
        f.write("Starting region probe...\n")
        f.flush()
        print("Starting region probe...", flush=True)
        for r in regions:
            print(f"Testing {r}...", end="", flush=True)
            success, msg = test_region(r)
            result_line = f"Region {r}: success={success}, msg={msg}\n"
            f.write(result_line)
            f.flush()
            if success:
                print(" SUCCESS!", flush=True)
                return
            else:
                print(" FAILED", flush=True)
    print("Done probing all regions.", flush=True)

if __name__ == '__main__':
    main()
