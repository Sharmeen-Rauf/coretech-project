const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString: "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  const r = await c.query("SELECT * FROM public.profiles WHERE id = 'ec9830b8-ae62-4ba0-944a-95e2a0427e02'");
  console.log("ADMIN PROFILE:");
  console.log(JSON.stringify(r.rows, null, 2));

  await c.end();
})();
