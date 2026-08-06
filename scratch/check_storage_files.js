const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString: "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  // 1. Check all files inside storage.objects table
  const storageObjects = await c.query("SELECT id, bucket_id, name, created_at, metadata FROM storage.objects ORDER BY created_at DESC LIMIT 50");
  console.log("=== FILES IN SUPABASE STORAGE (storage.objects) ===");
  console.log("Total objects in storage:", storageObjects.rows.length);
  storageObjects.rows.forEach((obj, idx) => {
    console.log(`[${idx + 1}] Bucket: ${obj.bucket_id} | Path: ${obj.name} | Created: ${obj.created_at}`);
  });

  // 2. Check all installer_jobs in DB
  const jobs = await c.query("SELECT id, job_title, serial_number, photos, notes, remarks, created_at FROM public.installer_jobs ORDER BY created_at DESC");
  console.log("\n=== ALL INSTALLER JOBS IN DB ===");
  jobs.rows.forEach((j, idx) => {
    console.log(`\n[${idx + 1}] Title: "${j.job_title}" | Serial: "${j.serial_number}" | ID: ${j.id}`);
    console.log("     Photos:", JSON.stringify(j.photos));
    console.log("     Notes:", j.notes ? j.notes.substring(0, 150) : "null");
  });

  await c.end();
})();
