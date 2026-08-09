const { Client } = require("pg");
const connectionString = "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("=== CHECKING REJECTED JOBS IN STOCK TABLE ===");
  const jobs = await client.query(
    "SELECT id, job_title, serial_number, status FROM public.installer_jobs WHERE status = 'rejected'"
  );

  for (const job of jobs.rows) {
    const stock = await client.query(
      "SELECT id, serial_no, status FROM public.stock WHERE LOWER(serial_no) = LOWER($1)",
      [job.serial_number]
    );
    console.log(`Job: "${job.job_title}" | Serial: "${job.serial_number}" | Stock Match Count: ${stock.rows.length}`, stock.rows);
  }

  await client.end();
}

main().catch(console.error);
