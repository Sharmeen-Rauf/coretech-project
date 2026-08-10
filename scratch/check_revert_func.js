const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString: "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  const r = await c.query("SELECT prosrc FROM pg_proc WHERE proname = 'fn_revert_rejected_installation_stock'");
  console.log("FUNCTION DEF:");
  console.log(r.rows[0]?.prosrc);

  await c.end();
})();
