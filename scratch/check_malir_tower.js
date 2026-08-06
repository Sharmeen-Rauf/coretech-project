const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString: "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  const r = await c.query("SELECT id, job_title, serial_number, photos, notes, remarks, created_at FROM public.installer_jobs WHERE serial_number ILIKE '%2605190274%'");
  
  console.log("MALIR TOWER JOB RECORD:");
  r.rows.forEach(row => {
    console.log("ID:", row.id);
    console.log("Title:", row.job_title);
    console.log("Serial:", row.serial_number);
    console.log("Photos:", JSON.stringify(row.photos));
    console.log("Notes FULL:", row.notes);
  });

  await c.end();
})();
