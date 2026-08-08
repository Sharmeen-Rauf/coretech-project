const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString: "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  console.log("=== ALL REJECTED INSTALLER JOBS ===");
  const rejectedJobs = await c.query("SELECT id, job_title, serial_number, status, notes FROM public.installer_jobs WHERE status = 'rejected'");
  console.log(rejectedJobs.rows);

  console.log("\n=== STOCK RECORDS FOR REJECTED JOBS ===");
  for (const j of rejectedJobs.rows) {
    let sn = j.serial_number ? j.serial_number.trim() : "";
    if (!sn && j.notes && j.notes.includes("SN:")) {
      const match = j.notes.match(/SN:\s*([^\s|]+)/);
      if (match && match[1]) sn = match[1].trim();
    }
    console.log(`Job ID: ${j.id} | Title: ${j.job_title} | Detected SN: "${sn}"`);
    if (sn) {
      const stock = await c.query("SELECT id, serial_no, status, installation_id FROM public.stock WHERE LOWER(serial_no) = LOWER($1)", [sn]);
      console.log("-> Stock Status:", stock.rows);
    }
  }

  await c.end();
})();
