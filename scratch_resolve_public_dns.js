const https = require('https');

function resolve(name) {
  return new Promise((resolve, reject) => {
    const url = `https://cloudflare-dns.com/dns-query?name=${name}&type=A`;
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
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  try {
    const res = await resolve('db.cypbnnohtipwavcwukhl.supabase.co');
    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.error(err);
  }
}

main();
