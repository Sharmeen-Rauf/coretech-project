const { Client } = require("pg");
const connectionString = "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Check BOTH serial numbers
  for (const sn of ["CTNX-8kW-2605190451", "CTNX-8kW-2605190167"]) {
    console.log(`\n=== ALL JOBS FOR ${sn} ===`);
    const jobs = await client.query(
      "SELECT id, job_title, serial_number, status, approval_note, verification_note, created_at FROM public.installer_jobs WHERE LOWER(serial_number) = LOWER($1) ORDER BY created_at",
      [sn]
    );
    console.log(JSON.stringify(jobs.rows, null, 2));

    console.log(`\n=== STOCK FOR ${sn} ===`);
    const stock = await client.query(
      "SELECT id, serial_no, status, installation_id FROM public.stock WHERE LOWER(serial_no) = LOWER($1)",
      [sn]
    );
    console.log(JSON.stringify(stock.rows, null, 2));
  }

  // Also check ALL rejected jobs for this installer
  console.log("\n=== ALL REJECTED JOBS FOR INSTALLER b70bd171 ===");
  const allRejected = await client.query(
    "SELECT id, job_title, serial_number, status, approval_note FROM public.installer_jobs WHERE installer_id = 'b70bd171-36a2-4cc4-a430-f7f4179b1c6f' ORDER BY created_at"
  );
  console.log(JSON.stringify(allRejected.rows, null, 2));

  await client.end();
}

main().catch(console.error);
