const { Client } = require("pg");
const connectionString = "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const cleanSNo = "CTNX-8kW-2605190167";

  console.log("=== SIMULATING VERIFY SERIAL FOR 'CTNX-8kW-2605190167' ===");

  // 1. Stock check
  const stockRes = await client.query(
    `SELECT s.*, p.name as product_name, p.brand, p.model 
     FROM public.stock s 
     LEFT JOIN public.products p ON s.product_id = p.id 
     WHERE LOWER(s.serial_no) = LOWER($1)`,
    [cleanSNo]
  );
  const stockData = stockRes.rows[0];

  // 2. Active jobs check
  const jobsRes = await client.query(
    "SELECT id, job_title, status FROM public.installer_jobs WHERE LOWER(serial_number) = LOWER($1)",
    [cleanSNo]
  );

  const activeJobs = jobsRes.rows.filter((j) => {
    const s = String(j.status || "").trim().toLowerCase();
    return s !== "rejected" && s !== "declined";
  });

  console.log("STOCK DATA:", stockData);
  console.log("ACTIVE JOBS COUNT:", activeJobs.length);

  if (activeJobs.length > 0) {
    console.log("RESULT: ERROR - Already registered for active job:", activeJobs[0].job_title);
  } else {
    console.log("RESULT: SUCCESS - Validated Product:", {
      product_name: stockData?.product_name || "CoreTech Solar Unit",
      brand: stockData?.brand || "CoreTech",
      model: stockData?.model_no || stockData?.model || "NexGen",
      warehouse_name: stockData?.warehouse_name || "Restored Inventory"
    });
  }

  await client.end();
}

main().catch(console.error);
