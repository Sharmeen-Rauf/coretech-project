const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString: "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  const r = await c.query("SELECT * FROM pg_policies WHERE tablename = 'objects'");
  console.log("POLICIES ON storage.objects:");
  console.log(JSON.stringify(r.rows, null, 2));

  await c.end();
})();
