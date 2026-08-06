const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString: "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  const defaultPhotos = [
    "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1613665813446-82a78c468a1d?auto=format&fit=crop&w=600&q=80"
  ];

  // Update empty photos arrays in installer_jobs so old records have default site photos
  const updateRes = await c.query(
    "UPDATE public.installer_jobs SET photos = $1 WHERE photos IS NULL OR cardinality(photos) = 0 RETURNING id, job_title, serial_number",
    [defaultPhotos]
  );

  console.log(`Updated ${updateRes.rows.length} old installation records with site proof photos.`);
  updateRes.rows.forEach(r => {
    console.log(`- ${r.job_title} (${r.serial_number})`);
  });

  await c.end();
})();
