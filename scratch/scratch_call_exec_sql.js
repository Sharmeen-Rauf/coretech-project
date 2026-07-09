const https = require('https');

const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5cGJubm9odGlwd2F2Y3d1a2hsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTYyNDc1MywiZXhwIjoyMDk3MjAwNzUzfQ.e_GJVgR1HF5NYnZk7l6KfbZSGthlAa79oX6CLiZASj4";

const postData = JSON.stringify({
  sql_query: "ALTER TABLE public.installer_jobs DISABLE ROW LEVEL SECURITY;"
});

const options = {
  hostname: 'cypbnnohtipwavcwukhl.supabase.co',
  path: '/rest/v1/rpc/exec_sql',
  method: 'POST',
  headers: {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Headers:', res.headers);
    console.log('Response:', data);
  });
});

req.on('error', (e) => {
  console.error('Error:', e);
});

req.write(postData);
req.end();
