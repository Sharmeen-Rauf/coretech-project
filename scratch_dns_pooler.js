const https = require('https');

function queryDNS(name, type = 'A') {
  return new Promise((resolve) => {
    https.get(`https://dns.google/resolve?name=${name}&type=${type}`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ error: e.message });
        }
      });
    }).on('error', (err) => {
      resolve({ error: err.message });
    });
  });
}

async function main() {
  // Try US East 1 pooler
  const p1 = await queryDNS('aws-0-us-east-1.pooler.supabase.com', 'A');
  console.log('US East A:', JSON.stringify(p1.Answer, null, 2));

  // Try AP Southeast 1 pooler (sometimes Asia/Pacific is used)
  const p2 = await queryDNS('aws-0-ap-southeast-1.pooler.supabase.com', 'A');
  console.log('AP Southeast A:', JSON.stringify(p2.Answer, null, 2));
  
  // Try US West 1 pooler
  const p3 = await queryDNS('aws-0-us-west-1.pooler.supabase.com', 'A');
  console.log('US West A:', JSON.stringify(p3.Answer, null, 2));
}

main();
