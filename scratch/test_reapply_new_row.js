const { Client } = require("pg");
const connectionString = "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const serialNo = "CTNX-8kW-2605190167";

  console.log("=== BEFORE: All installer_jobs rows for", serialNo, "===");
  const before = await client.query(
    "SELECT id, job_title, serial_number, status, approval_note, verification_note, created_at FROM public.installer_jobs WHERE LOWER(serial_number) = LOWER($1) ORDER BY created_at",
    [serialNo]
  );
  console.log(JSON.stringify(before.rows, null, 2));

  console.log("\n=== STOCK STATUS ===");
  const stock = await client.query(
    "SELECT id, serial_no, status, installation_id FROM public.stock WHERE LOWER(serial_no) = LOWER($1)",
    [serialNo]
  );
  console.log(JSON.stringify(stock.rows, null, 2));

  // Verify: the rejected row must still exist and be untouched
  const rejectedRows = before.rows.filter(r => r.status === "rejected" || r.status === "declined");
  console.log("\n=== REJECTED ROWS (must remain untouched) ===");
  console.log(`Count: ${rejectedRows.length}`);
  rejectedRows.forEach(r => {
    console.log(`  ID: ${r.id}, Status: ${r.status}, Reason: ${r.approval_note || r.verification_note || "N/A"}`);
  });

  // Verify: any pending_verification row must be a DIFFERENT id from the rejected one
  const pendingRows = before.rows.filter(r => r.status === "pending_verification");
  console.log("\n=== PENDING_VERIFICATION ROWS (new re-apply submissions) ===");
  console.log(`Count: ${pendingRows.length}`);
  pendingRows.forEach(r => {
    const isDistinctFromRejected = !rejectedRows.some(rej => rej.id === r.id);
    console.log(`  ID: ${r.id}, Status: ${r.status}, Distinct from rejected: ${isDistinctFromRejected}`);
  });

  await client.end();
}

main().catch(console.error);
