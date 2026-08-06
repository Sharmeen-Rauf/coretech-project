const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString: "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  // Check column types
  const r = await c.query(
    "SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name='installer_jobs' AND column_name IN ('photos','notes','video_url') ORDER BY ordinal_position"
  );
  console.log("COLUMN TYPES:");
  console.log(JSON.stringify(r.rows, null, 2));

  // Sample data
  const s = await c.query(
    "SELECT id, job_title, photos, notes FROM public.installer_jobs ORDER BY created_at DESC LIMIT 3"
  );
  console.log("\nSAMPLE DATA:");
  s.rows.forEach(row => {
    console.log("---");
    console.log("ID:", row.id);
    console.log("Title:", row.job_title);
    console.log("Photos type:", typeof row.photos);
    console.log("Photos is array:", Array.isArray(row.photos));
    const photosStr = JSON.stringify(row.photos);
    console.log("Photos value:", photosStr ? photosStr.substring(0, 300) : "null");
    console.log("Notes:", row.notes ? row.notes.substring(0, 200) : "null");
  });

  await c.end();
})();
