const { Client } = require("pg");
const connectionString = "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("=== CHECKING RECORD BEFORE UPDATE ===");
  const before = await client.query("SELECT id, job_title, serial_number, status, approval_note, verification_note FROM public.installer_jobs WHERE LOWER(serial_number) = LOWER('CTNX-8kW-2605190039')");
  console.log("BEFORE:", JSON.stringify(before.rows, null, 2));

  console.log("\n=== SIMULATING RE-SUBMISSION UPDATE ===");
  const targetJobId = before.rows[0]?.id || "5e476090-b058-4550-a6ea-30b3acbd6f51";

  const updateRes = await client.query(
    `UPDATE public.installer_jobs 
     SET status = 'pending_verification',
         serial_number = $1,
         remarks = $2,
         photos = $3,
         notes = $4,
         approval_note = NULL,
         verification_note = NULL,
         updated_at = NOW()
     WHERE id = $5
     RETURNING id, status`,
    [
      "CTNX-8kW-2605190039",
      "Re-submitted proof for testing",
      JSON.stringify(["https://res.cloudinary.com/demo/image/upload/sample.jpg"]),
      "[METADATA] SN:CTNX-8kW-2605190039 | VIDEO: | REM:Re-submitted proof\nCONNECTED PRODUCT: CoreTech NexGen 8KW IP66 (NexGen 8KW)",
      targetJobId
    ]
  );

  console.log("UPDATE RES:", JSON.stringify(updateRes.rows, null, 2));

  console.log("\n=== CHECKING RECORD AFTER UPDATE ===");
  const after = await client.query("SELECT id, job_title, serial_number, status, approval_note, verification_note FROM public.installer_jobs WHERE id = $1", [targetJobId]);
  console.log("AFTER:", JSON.stringify(after.rows, null, 2));

  await client.end();
}

main().catch(console.error);
