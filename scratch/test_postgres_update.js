const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString: "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  try {
    await c.query("BEGIN");
    console.log("Running UPDATE query...");
    const res = await c.query(
      `UPDATE public.installer_jobs 
       SET status = 'pending_verification',
           job_title = $1,
           address = $2,
           serial_number = $3,
           remarks = $4,
           photos = $5,
           notes = $6,
           approval_note = NULL,
           verification_note = NULL,
           is_resubmitted = TRUE
       WHERE id = $7
       RETURNING id`,
      [
        'yaa allah reham',
        'malir colony',
        'CTNX-8kW-2605190193',
        'Test Re-submit remarks',
        ['https://images.unsplash.com/photo-1509391365360-2e959784a276?w=600&auto=format&fit=crop'],
        'notes',
        'f35392c1-719d-42cc-bfaf-2645303e3413'
      ]
    );
    console.log("UPDATE result:", res.rows);
    await c.query("COMMIT");
    console.log("Transaction committed successfully!");
  } catch (err) {
    console.error("Database query failed:", err);
    await c.query("ROLLBACK");
  } finally {
    await c.end();
  }
})();
