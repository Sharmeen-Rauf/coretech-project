const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString: "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  try {
    await c.query("BEGIN");

    const siteFormJobId = "f35392c1-719d-42cc-bfaf-2645303e3413";
    const payload = {
      job_title: "yaa allah reham",
      address: "malir colony",
      serial_number: "CTNX-8kW-2605190193",
      remarks: "Test Re-submit",
      photos: ["https://cypbnnohtipwavcwukhl.supabase.co/storage/v1/object/public/job-photos/verification/1786346490940-96iq1t.png"],
      notes: "[METADATA] SN:CTNX-8kW-2605190193 | VIDEO:https://cypbnnohtipwavcwukhl.supabase.co/storage/v1/object/public/job-photos/installer-videos/1786346490938-qckfth.mp4 | REM:\nCONNECTED PRODUCT: CoreTech NexGen 8KW IP66 (NexGen 8KW)"
    };

    console.log("Updating job...");
    const jobResult = await c.query(
      `UPDATE public.installer_jobs 
       SET status = 'pending_verification',
           job_title = $1,
           address = $2,
           serial_number = $3,
           remarks = $4,
           photos = $5,
           notes = $6,
           approval_note = NULL,
           verification_note = NULL
       WHERE id = $7
       RETURNING id`,
      [
        payload.job_title,
        payload.address,
        payload.serial_number,
        payload.remarks || "",
        payload.photos,
        payload.notes || "",
        siteFormJobId
      ]
    );

    console.log("Job result:", jobResult.rows);

    await c.query("COMMIT");
    console.log("Transaction committed!");
  } catch (err) {
    await c.query("ROLLBACK");
    console.error("ERROR EXECUTING QUERY:", err);
  } finally {
    await c.end();
  }
})();
