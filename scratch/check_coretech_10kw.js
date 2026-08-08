const { Client } = require("pg");
const connectionString = "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const res = await client.query(
    "SELECT id, job_title, serial_number, status, approval_note, verification_note FROM public.installer_jobs WHERE LOWER(serial_number) = LOWER('CTNX-8kW-2605190039') OR LOWER(job_title) LIKE '%coretech 10kw%'"
  );

  console.log("FOUND JOBS:", JSON.stringify(res.rows, null, 2));

  await client.end();
}

main().catch(console.error);
