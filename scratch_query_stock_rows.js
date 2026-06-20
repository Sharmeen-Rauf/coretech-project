const https = require('https');
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

const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const options = {
  hostname: 'cypbnnohtipwavcwukhl.supabase.co',
  path: '/rest/v1/stock?select=*&limit=5',
  headers: {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`
  }
};

https.get(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('Stock rows:');
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.error('Failed to parse stock:', e, data);
    }
  });
}).on('error', (err) => {
  print(err);
});
