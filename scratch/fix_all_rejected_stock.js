const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString: "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  // Find all rejected installer jobs
  const rejectedJobs = await c.query("SELECT id, job_title, serial_number FROM public.installer_jobs WHERE status = 'rejected'");
  console.log(`Found ${rejectedJobs.rows.length} rejected installation jobs in database.`);

  let restoredCount = 0;
  for (const job of rejectedJobs.rows) {
    if (job.serial_number) {
      const res = await c.query(`
        UPDATE public.stock
        SET status = 'active',
            sold_out_at = NULL,
            sold_out_by_installer_id = NULL,
            installation_id = NULL,
            installation_project_title = NULL,
            deployment_site_address = NULL
        WHERE LOWER(serial_no) = LOWER($1);
      `, [job.serial_number.trim()]);
      
      if (res.rowCount > 0) {
        restoredCount += res.rowCount;
        console.log(`Restored serial "${job.serial_number}" (Job: ${job.job_title}) back to active inventory!`);
      }
    }
  }

  console.log(`\nDONE! Restored total ${restoredCount} serial numbers back to Active Inventory.`);

  await c.end();
})();
