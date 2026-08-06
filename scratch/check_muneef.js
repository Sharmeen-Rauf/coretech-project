const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString: "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  const cleanSNo = "CTNX-8kW-2605190039".toLowerCase();

  // 1. Stock check
  const stock = await c.query("SELECT * FROM public.stock WHERE LOWER(serial_no) = $1", [cleanSNo]);
  console.log("=== STOCK RECORD FOR CTNX-8kW-2605190039 ===");
  console.log(JSON.stringify(stock.rows, null, 2));

  // 2. All jobs for this serial number
  const jobs = await c.query("SELECT * FROM public.installer_jobs WHERE LOWER(serial_number) = $1", [cleanSNo]);
  console.log("\n=== ALL JOBS FOR CTNX-8kW-2605190039 ===");
  console.log(JSON.stringify(jobs.rows, null, 2));

  await c.end();
})();
