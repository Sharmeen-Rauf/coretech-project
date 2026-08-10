const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString: "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  const r = await c.query("SELECT id, first_name, role, designation FROM public.profiles WHERE designation LIKE '%sharmeentesting@gmail.com%' OR first_name ILIKE '%sharmeen%'");
  console.log("SHARMEEN PROFILES:");
  console.log(JSON.stringify(r.rows, null, 2));

  await c.end();
})();
