const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5cGJubm9odGlwd2F2Y3d1a2hsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTYyNDc1MywiZXhwIjoyMDk3MjAwNzUzfQ.e_GJVgR1HF5NYnZk7l6KfbZSGthlAa79oX6CLiZASj4";
const PROJECT_REF = "cypbnnohtipwavcwukhl";

async function main() {
  const sql = "ALTER TABLE public.installer_jobs DISABLE ROW LEVEL SECURITY;";
  console.log("Sending disable RLS query to pg/query...");
  const res = await fetch(`https://${PROJECT_REF}.supabase.co/pg/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });
  
  console.log("pg/query status:", res.status);
  const text = await res.text();
  console.log("pg/query response:", text);
}

main().catch(console.error);
