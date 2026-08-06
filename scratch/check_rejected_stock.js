const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString: "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  const r = await c.query("SELECT id, serial_no, status, sold_out_at, sold_out_by_installer_id, installation_id FROM public.stock WHERE LOWER(serial_no) = LOWER('CTNX-8kW-2605190039')");
  
  console.log("STOCK ITEM STATUS FOR CTNX-8kW-2605190039:");
  console.log(JSON.stringify(r.rows, null, 2));

  const job = await c.query("SELECT id, job_title, serial_number, status FROM public.installer_jobs WHERE LOWER(serial_number) = LOWER('CTNX-8kW-2605190039')");
  console.log("\nINSTALLER JOBS FOR THIS SERIAL:");
  console.log(JSON.stringify(job.rows, null, 2));

  await c.end();
})();
