const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString: "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  try {
    console.log("Creating database performance indexes...");

    // 1. Lowercase serial number expression index on public.stock
    await c.query(`
      CREATE INDEX IF NOT EXISTS idx_stock_serial_no_lower
      ON public.stock (LOWER(serial_no));
    `);
    console.log("✓ Created index 'idx_stock_serial_no_lower'");

    // 2. Lowercase serial number expression index on public.installer_jobs
    await c.query(`
      CREATE INDEX IF NOT EXISTS idx_installer_jobs_serial_lower
      ON public.installer_jobs (LOWER(serial_number));
    `);
    console.log("✓ Created index 'idx_installer_jobs_serial_lower'");

    // 3. Status B-tree index on public.stock
    await c.query(`
      CREATE INDEX IF NOT EXISTS idx_stock_status
      ON public.stock (status);
    `);
    console.log("✓ Created index 'idx_stock_status'");

    // 4. Status B-tree index on public.installer_jobs
    await c.query(`
      CREATE INDEX IF NOT EXISTS idx_installer_jobs_status
      ON public.installer_jobs (status);
    `);
    console.log("✓ Created index 'idx_installer_jobs_status'");

    // 5. Role index on public.profiles
    await c.query(`
      CREATE INDEX IF NOT EXISTS idx_profiles_role
      ON public.profiles (role);
    `);
    console.log("✓ Created index 'idx_profiles_role'");

    console.log("\nALL DATABASE INDEXES CREATED SUCCESSFULLY!");
  } catch (err) {
    console.error("Index creation error:", err);
  } finally {
    await c.end();
  }
})();
