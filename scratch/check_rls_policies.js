const { Client } = require("pg");
const connectionString = "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("=== RLS POLICIES ON installer_jobs ===");
  const res = await client.query(
    "SELECT tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'installer_jobs'"
  );
  console.log(JSON.stringify(res.rows, null, 2));

  console.log("\n=== RLS ENABLED STATUS ===");
  const rlsStatus = await client.query(
    "SELECT relname, relrowsecurity, relforce_row_security FROM pg_class WHERE relname = 'installer_jobs'"
  );
  console.log(JSON.stringify(rlsStatus.rows, null, 2));

  await client.end();
}

main().catch(console.error);
