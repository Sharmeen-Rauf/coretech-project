const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString: "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  // Check the specific record from screenshot: CTNX-8kW-2605190039
  const r = await c.query(
    "SELECT id, job_title, serial_number, photos, notes, created_at FROM public.installer_jobs WHERE serial_number ILIKE '%2605190039%' OR created_at > '2026-08-06' ORDER BY created_at DESC LIMIT 10"
  );

  console.log("RECORDS FOUND:", r.rows.length);
  r.rows.forEach(row => {
    console.log("===");
    console.log("ID:", row.id);
    console.log("Title:", row.job_title);
    console.log("Serial:", row.serial_number);
    console.log("Created:", row.created_at);
    console.log("Photos type:", typeof row.photos);
    console.log("Photos is array:", Array.isArray(row.photos));
    console.log("Photos FULL:", JSON.stringify(row.photos));
    console.log("Notes FULL:", row.notes);
  });

  await c.end();
})();
