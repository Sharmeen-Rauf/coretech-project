const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: '2406:da18:e5c:b702:61ce:d1b4:e1a4:a3c8', // IPv6 address of db.cypbnnohtipwavcwukhl.supabase.co
    user: 'postgres',
    database: 'postgres',
    password: 'munifpaisedega',
    port: 5432,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('CONNECTED TO POSTGRES SUCCESSFULLY VIA DIRECT IPV6!');
    
    // Disable RLS on installer_jobs
    await client.query("ALTER TABLE public.installer_jobs DISABLE ROW LEVEL SECURITY;");
    console.log('Disabled RLS on installer_jobs successfully!');
    
    await client.end();
  } catch (err) {
    console.error('Connection failed:', err);
  }
}

main().catch(console.error);
