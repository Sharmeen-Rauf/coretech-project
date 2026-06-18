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
  path: '/rest/v1/',
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
      console.log('Paths in API:');
      Object.keys(json.paths).forEach(p => {
        console.log(' -', p);
      });
      fs.writeFileSync('scratch_openapi.json', JSON.stringify(json, null, 2));
      console.log('OpenAPI schema saved to scratch_openapi.json');
    } catch (e) {
      console.error('Failed to parse OpenAPI:', e);
      console.log('Response content:', data);
    }
  });
}).on('error', (err) => {
  console.error('Request error:', err);
});
