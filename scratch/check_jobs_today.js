const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString: "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  const r = await c.query("SELECT id, job_title, serial_number, status, created_at FROM public.installer_jobs WHERE LOWER(serial_number) = 'ctnx-8kw-2605190193'");
  
  console.log("JOBS WITH SERIAL CTNX-8kW-2605190193:");
  console.log(JSON.stringify(r.rows, null, 2));

  await c.end();
})();
