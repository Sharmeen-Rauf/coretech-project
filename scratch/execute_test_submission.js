const { Client } = require("pg");
const connectionString = "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("=== EXECUTING DIRECT RE-SUBMISSION FOR 'testing false' (CTNX-8kW-2605190167) ===");
  const targetJobId = "96e91808-1106-4940-be5d-e0fac796012d";

  const updateRes = await client.query(
    `UPDATE public.installer_jobs 
     SET status = 'pending_verification',
         job_title = COALESCE(NULLIF($1, ''), job_title),
         address = COALESCE(NULLIF($2, ''), address),
         serial_number = $3,
         remarks = $4,
         photos = $5,
         notes = $6,
         approval_note = NULL,
         verification_note = NULL
     WHERE id = $7
     RETURNING id, job_title, serial_number, status`,
    [
      "testing false",
      "malir center",
      "CTNX-8kW-2605190167",
      "Updated proof photo and video re-submitted by installer",
      ["https://images.unsplash.com/photo-1509391365360-2e959784a276?w=600&auto=format&fit=crop"],
      "[METADATA] SN:CTNX-8kW-2605190167 | VIDEO: | REM:Updated proof photo and video re-submitted\nCONNECTED PRODUCT: CoreTech NexGen 8KW IP66 (NexGen 8KW)",
      targetJobId
    ]
  );

  console.log("UPDATE RES:\n", JSON.stringify(updateRes.rows, null, 2));

  console.log("\n=== VERIFYING STATUS IN DB AFTER UPDATE ===");
  const check = await client.query(
    "SELECT id, job_title, serial_number, status, approval_note, verification_note FROM public.installer_jobs WHERE id = $1",
    [targetJobId]
  );
  console.log("AFTER CHECK:\n", JSON.stringify(check.rows, null, 2));

  await client.end();
}

main().catch(console.error);
