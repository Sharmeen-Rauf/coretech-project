const { Client } = require("pg");
const connectionString = "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("=== CHECKING DATABASE TRIGGERS ===");
  const triggers = await client.query(`
    SELECT 
      trigger_name, 
      event_manipulation, 
      event_object_table, 
      action_statement, 
      action_timing
    FROM information_schema.triggers;
  `);
  
  // Filter for profiles or auth.users or custom triggers
  const filtered = triggers.rows.filter(t => 
    t.event_object_table.includes("profiles") || 
    t.event_object_table.includes("users") ||
    t.trigger_name.includes("role") ||
    t.trigger_name.includes("sync")
  );
  console.log("Triggers:", JSON.stringify(filtered, null, 2));

  console.log("\n=== CHECKING CUSTOM FUNCTIONS ===");
  const functions = await client.query(`
    SELECT routine_name, routine_type
    FROM information_schema.routines
    WHERE routine_schema = 'public' OR routine_name LIKE '%sync%' OR routine_name LIKE '%role%';
  `);
  console.log("Functions:", JSON.stringify(functions.rows, null, 2));

  await client.end();
}

main().catch(console.error);
