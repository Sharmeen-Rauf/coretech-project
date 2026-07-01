// Step 1: Create the exec_sql RPC function using service_role + raw SQL endpoint
// Step 2: Use it to add RLS policies to all tables

const SUPABASE_URL = "https://cypbnnohtipwavcwukhl.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5cGJubm9odGlwd2F2Y3d1a2hsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTYyNDc1MywiZXhwIjoyMDk3MjAwNzUzfQ.e_GJVgR1HF5NYnZk7l6KfbZSGthlAa79oX6CLiZASj4";
const PROJECT_REF = "cypbnnohtipwavcwukhl";

// Use the Supabase Management API to run SQL
// https://supabase.com/docs/reference/api/v1-database-query
async function execSQL(sql) {
  // Try the pg_graphql/SQL endpoint
  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "Prefer": "return=representation",
    },
    body: sql,
  });
  return res;
}

// Alternative: Use the service role key to create the function first via PostgREST
async function createExecSqlFunction() {
  const createFunctionSQL = `
    CREATE OR REPLACE FUNCTION exec_sql(sql_query text)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      EXECUTE sql_query;
    END;
    $$;
  `;
  
  // PostgREST doesn't allow raw SQL. We need to use the pg-meta API endpoint instead.
  // The Supabase dashboard uses: POST /pg/query with Authorization
  
  console.log("Attempting to use Supabase pg-meta endpoint...");
  const res = await fetch(`https://${PROJECT_REF}.supabase.co/pg/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: createFunctionSQL }),
  });
  
  console.log("pg/query status:", res.status);
  const text = await res.text();
  console.log("pg/query response:", text.substring(0, 500));
  return res.ok;
}

async function tryManagementAPI() {
  // Try the official management API endpoint
  const sql = `
    CREATE OR REPLACE FUNCTION exec_sql(sql_query text)
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
    BEGIN EXECUTE sql_query; END; $$;
  `;
  
  console.log("\nTrying management API...");
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });
  
  console.log("Management API status:", res.status);
  const text = await res.text();
  console.log("Management API response:", text.substring(0, 500));
  return res.ok;
}

async function main() {
  // Try pg-meta first
  const pgMetaOk = await createExecSqlFunction();
  if (!pgMetaOk) {
    await tryManagementAPI();
  }
}

main().catch(console.error);
