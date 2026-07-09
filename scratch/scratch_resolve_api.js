const https = require('https');

function resolve(name) {
  return new Promise((resolve, reject) => {
    const url = `https://cloudflare-dns.com/dns-query?name=${name}`;
    const options = {
      headers: {
        'Accept': 'application/dns-json'
      }
    };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('Resolving cypbnnohtipwavcwukhl.supabase.co...');
  console.log(await resolve('cypbnnohtipwavcwukhl.supabase.co'));
  console.log('Resolving db.cypbnnohtipwavcwukhl.supabase.co...');
  console.log(await resolve('db.cypbnnohtipwavcwukhl.supabase.co'));
}

main().catch(console.error);
