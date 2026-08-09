const { Client } = require("pg");
const connectionString = "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const res = await client.query(
    "SELECT id, first_name, last_name, role FROM public.profiles WHERE LOWER(first_name) LIKE '%muneef%' OR LOWER(last_name) LIKE '%rauf%'"
  );

  console.log("PROFILES FOR MUNEEF RAUF:\n", JSON.stringify(res.rows, null, 2));

  const allJobs = await client.query(
    "SELECT id, job_title, serial_number, status, installer_id, approval_note, created_at FROM public.installer_jobs ORDER BY created_at DESC LIMIT 20"
  );
  console.log("\nALL RECENT INSTALLER JOBS:\n", JSON.stringify(allJobs.rows, null, 2));

  await client.end();
}

main().catch(console.error);
