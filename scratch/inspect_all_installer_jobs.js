const { Client } = require("pg");
const connectionString = "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("=== INSIGHT: ALL INSTALLER JOBS IN POSTGRESQL ===");
  const res = await client.query(
    "SELECT id, job_title, serial_number, status, installer_id, approval_note, verification_note, created_at FROM public.installer_jobs ORDER BY created_at DESC LIMIT 30"
  );
  console.log(JSON.stringify(res.rows, null, 2));

  console.log("\n=== STATUS BREAKDOWN ===");
  const counts = await client.query(
    "SELECT status, COUNT(*) FROM public.installer_jobs GROUP BY status"
  );
  console.log(JSON.stringify(counts.rows, null, 2));

  await client.end();
}

main().catch(console.error);
