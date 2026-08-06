const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString: "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  const cleanSNo = "CTNX-8kW-2605190039".toLowerCase();

  // 1. Stock check
  const stock = await c.query("SELECT s.*, p.name, p.brand, p.model FROM public.stock s LEFT JOIN public.products p ON s.product_id = p.id WHERE LOWER(s.serial_no) = $1", [cleanSNo]);
  console.log("=== STOCK RECORD ===");
  console.log(stock.rows);

  // 2. Active non-rejected installer jobs check
  const activeJobs = await c.query("SELECT id, job_title, serial_number, status FROM public.installer_jobs WHERE LOWER(serial_number) = $1 AND status != 'rejected'", [cleanSNo]);
  console.log("\n=== ACTIVE NON-REJECTED JOBS FOR SERIAL ===");
  console.log(activeJobs.rows);

  if (stock.rows.length > 0 && stock.rows[0].status === "active" && activeJobs.rows.length === 0) {
    console.log("\nSUCCESS! Serial number CTNX-8kW-2605190039 is ACTIVE in inventory and ready to be used by any installer!");
  } else {
    console.log("\nFAIL: Serial number is still blocked!");
  }

  await c.end();
})();
