const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString: "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  try {
    // 1. Ensure job-photos bucket exists and is public
    await c.query(`
      INSERT INTO storage.buckets (id, name, public) 
      VALUES ('job-photos', 'job-photos', true) 
      ON CONFLICT (id) DO UPDATE SET public = true;
    `);
    console.log("Bucket 'job-photos' verified/updated.");

    // 2. Create permissive RLS policies on storage.objects for job-photos bucket
    await c.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Public Access to job-photos'
        ) THEN
          CREATE POLICY "Public Access to job-photos" ON storage.objects
            FOR ALL USING (bucket_id = 'job-photos') WITH CHECK (bucket_id = 'job-photos');
        END IF;
      END $$;
    `);
    console.log("Created policy 'Public Access to job-photos'.");

    // 3. Enable RLS or ensure policy is active
    await c.query(`
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    `);
    console.log("Row level security enabled/active on storage.objects.");

  } catch (err) {
    console.error("Failed to update storage policies:", err);
  } finally {
    await c.end();
  }
})();
