const dns = require('dns');
const originalLookup = dns.lookup;

dns.lookup = function(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (hostname === 'db.cypbnnohtipwavcwukhl.supabase.co') {
    originalLookup('aws-0-ap-southeast-1.pooler.supabase.com', options, (err, ip, addressType) => {
      console.log('Intercepted lookup for db.cypbnnohtipwavcwukhl.supabase.co ->', ip);
      callback(err, ip, addressType || 4);
    });
  } else {
    originalLookup(hostname, options, callback);
  }
};

const { Client } = require('pg');

const client = new Client({
  host: 'db.cypbnnohtipwavcwukhl.supabase.co',
  user: 'postgres',
  database: 'postgres',
  password: 'munifpaisedega',
  port: 6543,
  ssl: {
    rejectUnauthorized: false,
    servername: 'db.cypbnnohtipwavcwukhl.supabase.co'
  }
});

async function main() {
  try {
    await client.connect();
    console.log('CONNECTED TO POSTGRES SUCCESSFULLY VIA GLOBAL INTERCEPT!');
    const res = await client.query('SELECT version();');
    console.log('Version:', res.rows[0]);
    await client.end();
  } catch (err) {
    console.error('Connection failed:', err);
  }
}

main();
