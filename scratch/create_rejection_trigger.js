const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString: "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  try {
    // 1. Create function to restore stock when job status becomes 'rejected'
    await c.query(`
      CREATE OR REPLACE FUNCTION public.fn_revert_rejected_installation_stock()
      RETURNS TRIGGER AS $$
      BEGIN
        IF (NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status != 'rejected')) THEN
          -- Revert stock item by installation_id
          UPDATE public.stock
          SET status = 'active',
              sold_out_at = NULL,
              sold_out_by_installer_id = NULL,
              installation_id = NULL,
              installation_project_title = NULL,
              deployment_site_address = NULL
          WHERE installation_id = NEW.id;

          -- Revert stock item by serial_number if present
          IF (NEW.serial_number IS NOT NULL AND TRIM(NEW.serial_number) != '') THEN
            UPDATE public.stock
            SET status = 'active',
                sold_out_at = NULL,
                sold_out_by_installer_id = NULL,
                installation_id = NULL,
                installation_project_title = NULL,
                deployment_site_address = NULL
            WHERE LOWER(serial_no) = LOWER(TRIM(NEW.serial_number)) AND status = 'sold_out';
          END IF;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log("Created function 'public.fn_revert_rejected_installation_stock'.");

    // 2. Attach trigger to public.installer_jobs table
    await c.query(`
      DROP TRIGGER IF EXISTS trg_revert_rejected_job_stock ON public.installer_jobs;
      CREATE TRIGGER trg_revert_rejected_job_stock
      AFTER UPDATE OR INSERT ON public.installer_jobs
      FOR EACH ROW
      EXECUTE FUNCTION public.fn_revert_rejected_installation_stock();
    `);
    console.log("Attached trigger 'trg_revert_rejected_job_stock' to table public.installer_jobs.");

    console.log("\nAUTOMATIC REJECTION TRIGGER INSTALLED SUCCESSFULLY!");
  } catch (err) {
    console.error("Failed to create rejection trigger:", err);
  } finally {
    await c.end();
  }
})();
