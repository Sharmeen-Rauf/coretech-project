const { Client } = require("pg");
const connectionString = "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const targetJobId = "5e476090-b058-4550-a6ea-30b3acbd6f51";

  console.log("=== EXECUTING PERFECT UPDATE QUERY ===");
  const photosArray = ["https://res.cloudinary.com/demo/image/upload/sample.jpg"];
  const updateRes = await client.query(
    `UPDATE public.installer_jobs 
     SET status = 'pending_verification',
         serial_number = $1,
         remarks = $2,
         photos = $3,
         notes = $4,
         approval_note = NULL,
         verification_note = NULL
     WHERE id = $5
     RETURNING id, status, job_title, serial_number`,
    [
      "CTNX-8kW-2605190039",
      "Re-submitted proof for testing",
      photosArray,
      "[METADATA] SN:CTNX-8kW-2605190039 | VIDEO: | REM:Re-submitted proof\nCONNECTED PRODUCT: CoreTech NexGen 8KW IP66 (NexGen 8KW)",
      targetJobId
    ]
  );

  console.log("SUCCESS! UPDATE RES:", JSON.stringify(updateRes.rows, null, 2));

  await client.end();
}

main().catch(console.error);
