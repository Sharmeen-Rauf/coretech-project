const { Client } = require("pg");
const connectionString = "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("=== 1. CHECK STOCK TABLE FOR CTNX-8kW-2605190167 ===");
  const stock = await client.query(
    "SELECT id, serial_no, status, installation_id, sold_out_at, sold_out_by_installer_id FROM public.stock WHERE LOWER(serial_no) = LOWER('CTNX-8kW-2605190167')"
  );
  console.log("STOCK ROW:\n", JSON.stringify(stock.rows, null, 2));

  console.log("\n=== 2. CHECK INSTALLER JOBS TABLE FOR CTNX-8kW-2605190167 ===");
  const jobs = await client.query(
    "SELECT id, job_title, serial_number, status, installer_id, approval_note, verification_note, created_at FROM public.installer_jobs WHERE LOWER(serial_number) = LOWER('CTNX-8kW-2605190167')"
  );
  console.log("INSTALLER JOBS ROWS:\n", JSON.stringify(jobs.rows, null, 2));

  await client.end();
}

main().catch(console.error);
