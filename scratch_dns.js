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
  const dbA = await queryDNS('db.cypbnnohtipwavcwukhl.supabase.co', 'A');
  console.log('db A:', JSON.stringify(dbA.Answer, null, 2));

  const dbAAAA = await queryDNS('db.cypbnnohtipwavcwukhl.supabase.co', 'AAAA');
  console.log('db AAAA:', JSON.stringify(dbAAAA.Answer, null, 2));

  const apiA = await queryDNS('cypbnnohtipwavcwukhl.supabase.co', 'A');
  console.log('api A:', JSON.stringify(apiA.Answer, null, 2));
}

main();
