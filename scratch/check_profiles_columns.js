const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString: "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  const r = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'profiles'");
  console.log("COLUMNS IN profiles:");
  console.log(JSON.stringify(r.rows, null, 2));

  await c.end();
})();
