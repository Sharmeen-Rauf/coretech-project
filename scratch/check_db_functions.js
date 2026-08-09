const { Client } = require("pg");
const connectionString = "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("=== CHECKING CUSTOM FUNCTIONS AND TRIGGERS ===");
  const triggers = await client.query(`
    SELECT trigger_name, event_manipulation, event_object_table, action_statement 
    FROM information_schema.triggers;
  `);
  console.log("TRIGGERS:\n", JSON.stringify(triggers.rows, null, 2));

  const functions = await client.query(`
    SELECT routine_name, routine_definition 
    FROM information_schema.routines 
    WHERE routine_schema = 'public';
  `);
  console.log("FUNCTIONS:\n", JSON.stringify(functions.rows, null, 2));

  await client.end();
}

main().catch(console.error);
