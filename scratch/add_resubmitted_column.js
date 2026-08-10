const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString: "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  try {
    console.log("Adding is_resubmitted column...");
    await c.query("ALTER TABLE public.installer_jobs ADD COLUMN IF NOT EXISTS is_resubmitted BOOLEAN DEFAULT FALSE;");
    console.log("Column added successfully!");
  } catch (err) {
    console.error("Error adding column:", err);
  } finally {
    await c.end();
  }
})();
