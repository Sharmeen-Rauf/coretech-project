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
  console.log("Attempting test insertion...");
  const { data, error } = await supabase
    .from('installer_jobs')
    .insert({
      job_title: 'Test Insertion',
      installer_id: '00000000-0000-0000-0000-000000000000', // dummy uuid
      serial_number: '123456789',
      photos: ['https://example.com/photo.jpg']
    })
    .select();

  if (error) {
    console.error('Postgrest Error code:', error.code);
    console.error('Postgrest Error message:', error.message);
  } else {
    console.log('Successfully inserted!', data);
  }
}

main();
