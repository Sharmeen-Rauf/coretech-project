const { Client } = require("pg");
const connectionString = "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const res = await client.query(
    "SELECT id, job_title, serial_number, status, installer_id, approval_note, created_at FROM public.installer_jobs WHERE LOWER(serial_number) = LOWER('CTNX-8kW-2605190039')"
  );

  console.log("ALL JOBS FOR CTNX-8kW-2605190039:\n", JSON.stringify(res.rows, null, 2));

  await client.end();
}

main().catch(console.error);
