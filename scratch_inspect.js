const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Simple parser for .env.local
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
  const { data, error } = await supabase
    .from('installer_jobs')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching job:', error);
  } else {
    console.log('Columns in installer_jobs:', data && data[0] ? Object.keys(data[0]) : 'No rows found');
    console.log('Sample row:', data && data[0] ? data[0] : 'None');
  }
}

main();
