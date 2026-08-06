const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString: "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  // Check storage buckets
  const buckets = await c.query("SELECT * FROM storage.buckets");
  console.log("STORAGE BUCKETS:");
  console.log(JSON.stringify(buckets.rows, null, 2));

  // Check RLS policies on storage.objects
  const policies = await c.query("SELECT * FROM pg_policies WHERE tablename = 'objects'");
  console.log("\nSTORAGE POLICIES:");
  console.log(JSON.stringify(policies.rows, null, 2));

  await c.end();
})();
