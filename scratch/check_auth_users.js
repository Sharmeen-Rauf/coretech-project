const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString: "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  const r = await c.query("SELECT p.id, p.first_name, p.role, u.email FROM public.profiles p JOIN auth.users u ON p.id = u.id WHERE p.role != 'installer'");
  console.log("NON-INSTALLER USERS WITH AUTH EMAIL:");
  console.log(JSON.stringify(r.rows, null, 2));

  await c.end();
})();
