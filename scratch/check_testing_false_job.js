const { Client } = require("pg");
const connectionString = "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("=== CHECKING JOB 'testing false' (CTNX-8kW-2605190167) ===");
  const job = await client.query(
    "SELECT id, job_title, address, serial_number, status, installer_id, approval_note, verification_note, created_at FROM public.installer_jobs WHERE LOWER(serial_number) = LOWER('CTNX-8kW-2605190167') OR LOWER(job_title) LIKE '%testing false%'"
  );
  console.log("DB JOB RECORD:\n", JSON.stringify(job.rows, null, 2));

  console.log("\n=== CHECKING INSTALLER PROFILE ===");
  if (job.rows.length > 0) {
    const profile = await client.query(
      "SELECT id, first_name, last_name, role FROM public.profiles WHERE id = $1",
      [job.rows[0].installer_id]
    );
    console.log("INSTALLER PROFILE:\n", JSON.stringify(profile.rows, null, 2));
  }

  await client.end();
}

main().catch(console.error);
