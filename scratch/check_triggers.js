const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString: "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  // 1. Check column default values
  console.log("=== COLUMN DEFAULTS ===");
  const defaults = await c.query(`
    SELECT column_name, column_default, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'installer_jobs' 
    AND column_name IN ('photos', 'notes', 'video_url')
  `);
  defaults.rows.forEach(r => console.log(r.column_name, "DEFAULT:", r.column_default, "TYPE:", r.data_type));

  // 2. Check for triggers on installer_jobs
  console.log("\n=== TRIGGERS ===");
  const triggers = await c.query(`
    SELECT trigger_name, event_manipulation, action_statement 
    FROM information_schema.triggers 
    WHERE event_object_table = 'installer_jobs'
  `);
  console.log("Trigger count:", triggers.rows.length);
  triggers.rows.forEach(r => {
    console.log("Trigger:", r.trigger_name, "Event:", r.event_manipulation);
    console.log("Action:", r.action_statement);
  });

  // 3. Check for functions that reference unsplash or default photos
  console.log("\n=== FUNCTIONS WITH UNSPLASH/MIXKIT ===");
  const funcs = await c.query(`
    SELECT routine_name, routine_definition 
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND (routine_definition ILIKE '%unsplash%' OR routine_definition ILIKE '%mixkit%' OR routine_definition ILIKE '%default%photo%')
  `);
  console.log("Function count:", funcs.rows.length);
  funcs.rows.forEach(r => {
    console.log("Function:", r.routine_name);
    console.log("Definition:", r.routine_definition?.substring(0, 500));
  });

  // 4. Check stored procedures/triggers that reference installer_jobs
  console.log("\n=== ALL TRIGGER FUNCTIONS ===");
  const trigFuncs = await c.query(`
    SELECT proname, prosrc 
    FROM pg_proc 
    WHERE prosrc ILIKE '%installer_jobs%' OR prosrc ILIKE '%unsplash%' OR prosrc ILIKE '%mixkit%'
  `);
  console.log("Count:", trigFuncs.rows.length);
  trigFuncs.rows.forEach(r => {
    console.log("---");
    console.log("Function:", r.proname);
    console.log("Source:", r.prosrc?.substring(0, 800));
  });

  await c.end();
})();
