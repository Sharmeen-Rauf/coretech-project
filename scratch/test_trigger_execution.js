const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString: "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  const testSerial = "TEST-TRIGGER-SERIAL-999";
  const testJobId = "99999999-9999-4999-9999-999999999999";

  try {
    // 1. Create a dummy stock item (status = sold_out)
    await c.query(`
      INSERT INTO public.stock (id, product_id, serial_no, status, warehouse_name)
      VALUES (gen_random_uuid(), (SELECT id FROM public.products LIMIT 1), $1, 'sold_out', 'Test Warehouse')
      ON CONFLICT (serial_no) DO UPDATE SET status = 'sold_out';
    `, [testSerial]);

    // 2. Insert dummy job (status = pending_verification)
    await c.query(`
      INSERT INTO public.installer_jobs (id, job_title, serial_number, status)
      VALUES ($1, 'Test Rejection Job', $2, 'pending_verification')
      ON CONFLICT (id) DO UPDATE SET status = 'pending_verification';
    `, [testJobId, testSerial]);

    console.log("Setup: Stock is 'sold_out', Job is 'pending_verification'.");

    // 3. Update job status to 'rejected'
    console.log("Action: Updating job status to 'rejected'...");
    await c.query(`
      UPDATE public.installer_jobs SET status = 'rejected' WHERE id = $1;
    `, [testJobId]);

    // 4. Verify stock status
    const stockResult = await c.query("SELECT serial_no, status FROM public.stock WHERE serial_no = $1", [testSerial]);
    console.log("\nResult after Trigger execution:");
    console.log("Stock Status:", stockResult.rows[0]?.status);

    if (stockResult.rows[0]?.status === "active") {
      console.log("\n🎉 TRIGGER TEST PASSED 100%! Stock automatically reverted to 'active' on rejection!");
    } else {
      console.log("\n❌ Trigger failed!");
    }

    // Cleanup test data
    await c.query("DELETE FROM public.installer_jobs WHERE id = $1", [testJobId]);
    await c.query("DELETE FROM public.stock WHERE serial_no = $1", [testSerial]);
    console.log("Cleanup complete.");

  } catch (err) {
    console.error("Test error:", err);
  } finally {
    await c.end();
  }
})();
