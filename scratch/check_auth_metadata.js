const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString: "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  const r = await c.query("SELECT id, email, raw_user_meta_data, raw_app_meta_data FROM auth.users WHERE id = '1d811896-6cc7-43b4-b34c-349a0dfb7868'");
  console.log("AUTH USER METADATA:");
  console.log(JSON.stringify(r.rows, null, 2));

  await c.end();
})();
