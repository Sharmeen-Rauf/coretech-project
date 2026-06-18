const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/(^"|"$)/g, '');
    env[key] = val;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log("Querying database tables...");

  // Profiles count by role
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, role, first_name, last_name');
  if (pErr) console.error("Profiles error:", pErr);
  else {
    const roles = {};
    profiles.forEach(p => { roles[p.role] = (roles[p.role] || 0) + 1; });
    console.log("Profiles count by role:", roles);
  }

  // Sales count by type
  const { data: sales, error: sErr } = await supabase.from('sales').select('id, type, warehouse, date');
  if (sErr) console.error("Sales error:", sErr);
  else {
    const types = {};
    sales.forEach(s => { types[s.type] = (types[s.type] || 0) + 1; });
    console.log("Sales count by type:", types);
  }

  // Orders count
  const { count: ordersCount, error: oErr } = await supabase.from('orders').select('*', { count: 'exact', head: true });
  if (oErr) console.error("Orders error:", oErr);
  else console.log("Orders count:", ordersCount);

  // Installer jobs count
  const { count: jobsCount, error: jErr } = await supabase.from('installer_jobs').select('*', { count: 'exact', head: true });
  if (jErr) console.error("Jobs error:", jErr);
  else console.log("Installer jobs count:", jobsCount);
}

main();
