const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString: "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  const r = await c.query("SELECT id, job_title, serial_number, photos, notes, status, created_at FROM public.installer_jobs ORDER BY created_at DESC");
  
  console.log("TOTAL JOBS IN DATABASE:", r.rows.length);
  r.rows.forEach((row, i) => {
    console.log(`\n--- JOB ${i + 1} ---`);
    console.log("ID:", row.id);
    console.log("Title:", row.job_title);
    console.log("Serial:", row.serial_number);
    console.log("Status:", row.status);
    console.log("Created:", row.created_at);
    console.log("Photos:", JSON.stringify(row.photos));
    console.log("Notes:", row.notes ? row.notes.substring(0, 120) : "null");
  });

  await c.end();
})();
