const { Client } = require("pg");
const connectionString = "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("=== FUNCTION DEFINITION ===");
  const funcDef = await client.query(`
    SELECT prosrc 
    FROM pg_proc 
    WHERE proname = 'inject_user_role';
  `);
  console.log(funcDef.rows[0]?.prosrc);

  console.log("\n=== TRIGGERS ON public.profiles ===");
  const profilesTriggers = await client.query(`
    SELECT tgname, tgenabled, tgtype, tgdeferrable
    FROM pg_trigger
    WHERE tgrelid = 'public.profiles'::regclass;
  `);
  console.log(JSON.stringify(profilesTriggers.rows, null, 2));

  await client.end();
}

main().catch(console.error);
