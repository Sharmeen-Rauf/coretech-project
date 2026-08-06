const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString: "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  const testSerial = "TEST-LIFECYCLE-SERIAL-777";
  const testJobId = "77777777-7777-4777-7777-777777777777";

  try {
    console.log("=== STEP 1: INITIAL ACTIVE INVENTORY ===");
    await c.query(`
      INSERT INTO public.stock (id, product_id, serial_no, status, warehouse_name)
      VALUES (gen_random_uuid(), (SELECT id FROM public.products LIMIT 1), $1, 'active', 'Test Warehouse')
      ON CONFLICT (serial_no) DO UPDATE SET status = 'active', installation_id = NULL;
    `, [testSerial]);

    let s1 = await c.query("SELECT serial_no, status, installation_id FROM public.stock WHERE serial_no = $1", [testSerial]);
    console.log("Initial Stock Status:", s1.rows[0]);

    console.log("\n=== STEP 2: INSTALLER SUBMITS (FIRST TIME) ===");
    await c.query(`
      INSERT INTO public.installer_jobs (id, job_title, serial_number, status)
      VALUES ($1, 'Lifecycle Test Job', $2, 'pending_verification')
      ON CONFLICT (id) DO UPDATE SET status = 'pending_verification';
    `, [testJobId, testSerial]);
    
    await c.query(`
      UPDATE public.stock SET status = 'sold_out', installation_id = $1 WHERE serial_no = $2;
    `, [testJobId, testSerial]);

    let s2 = await c.query("SELECT serial_no, status, installation_id FROM public.stock WHERE serial_no = $1", [testSerial]);
    console.log("After Submit Stock Status:", s2.rows[0]);

    console.log("\n=== STEP 3: RM / CH REJECTS INSTALLATION ===");
    await c.query(`UPDATE public.installer_jobs SET status = 'rejected' WHERE id = $1;`, [testJobId]);

    // Give trigger a moment
    let s3 = await c.query("SELECT serial_no, status, installation_id FROM public.stock WHERE serial_no = $1", [testSerial]);
    console.log("After Rejection Stock Status (Auto Reverted):", s3.rows[0]);

    console.log("\n=== STEP 4: INSTALLER EDITS & RE-SUBMITS ===");
    await c.query(`
      UPDATE public.installer_jobs SET status = 'pending_verification' WHERE id = $1;
    `, [testJobId]);
    await c.query(`
      UPDATE public.stock SET status = 'sold_out', installation_id = $1 WHERE serial_no = $2 AND (status = 'active' OR installation_id = $1);
    `, [testJobId, testSerial]);

    let s4 = await c.query("SELECT serial_no, status, installation_id FROM public.stock WHERE serial_no = $1", [testSerial]);
    console.log("After Re-submit Stock Status:", s4.rows[0]);

    if (s1.rows[0].status === "active" && s2.rows[0].status === "sold_out" && s3.rows[0].status === "active" && s4.rows[0].status === "sold_out") {
      console.log("\n🎉 FULL LIFECYCLE TEST PASSED 100%! Product properly cycles active -> sold_out -> active -> sold_out!");
    } else {
      console.log("\n❌ Lifecycle failed");
    }

    // Cleanup
    await c.query("DELETE FROM public.installer_jobs WHERE id = $1", [testJobId]);
    await c.query("DELETE FROM public.stock WHERE serial_no = $1", [testSerial]);

  } catch (err) {
    console.error("Test error:", err);
  } finally {
    await c.end();
  }
})();
