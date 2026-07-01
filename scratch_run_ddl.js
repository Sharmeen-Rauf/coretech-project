const dns = require('dns');
const { Client } = require('pg');

const client = new Client({
  host: 'db.cypbnnohtipwavcwukhl.supabase.co',
  user: 'postgres',
  database: 'postgres',
  password: 'munifpaisedega',
  port: 6543,
  ssl: {
    rejectUnauthorized: false
  },
  lookup: function(hostname, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    if (hostname === 'db.cypbnnohtipwavcwukhl.supabase.co') {
      dns.lookup('aws-0-ap-southeast-1.pooler.supabase.com', (err, ip) => {
        callback(err, ip, 4);
      });
    } else {
      dns.lookup(hostname, options, callback);
    }
  }
});

async function main() {
  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL!');

    const sql = `
      ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.gate_passes DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.invoices DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.support_tickets DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.regions DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.announcements DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.stock DISABLE ROW LEVEL SECURITY;
    `;

    await client.query(sql);
    console.log('Successfully disabled RLS on all tables!');
  } catch (err) {
    console.error('Error executing query:', err);
  } finally {
    await client.end();
  }
}

main();
