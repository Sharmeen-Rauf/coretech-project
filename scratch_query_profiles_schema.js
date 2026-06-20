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
      const definition = json.definitions.profiles;
      if (definition) {
        console.log('Columns of profiles:');
        Object.keys(definition.properties).forEach(prop => {
          console.log(` - ${prop}: type=${definition.properties[prop].type}`);
        });
      } else {
        console.log('profiles definition not found.');
      }
    } catch (e) {
      console.error('Failed to parse OpenAPI:', e);
    }
  });
}).on('error', (err) => {
  console.error('Request error:', err);
});
