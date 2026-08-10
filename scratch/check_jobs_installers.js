const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString: "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  const jobsRes = await c.query("SELECT id, job_title, installer_id, status FROM public.installer_jobs");
  console.log("ALL JOBS IN DB:", jobsRes.rows.length);
  console.log(JSON.stringify(jobsRes.rows, null, 2));

  const profilesRes = await c.query("SELECT id, first_name, last_name, role FROM public.profiles");
  console.log("\nALL PROFILES IN DB:", profilesRes.rows.length);
  console.log(JSON.stringify(profilesRes.rows, null, 2));

  await c.end();
})();
