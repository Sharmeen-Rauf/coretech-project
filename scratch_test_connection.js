const { Client } = require('pg');

const formats = [
  { user: 'postgres.cypbnnohtipwavcwukhl', database: 'postgres' },
  { user: 'postgres@cypbnnohtipwavcwukhl', database: 'postgres' },
  { user: 'cypbnnohtipwavcwukhl.postgres', database: 'postgres' },
  { user: 'postgres', database: 'cypbnnohtipwavcwukhl' },
  { user: 'postgres', database: 'postgres' },
];

async function test(format) {
  const client = new Client({
    user: format.user,
    host: 'aws-0-ap-southeast-1.pooler.supabase.com',
    database: format.database,
    password: 'munifpaisedega',
    port: 6543,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 3000
  });

  try {
    await client.connect();
    await client.end();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function main() {
  for (const format of formats) {
    console.log(`Testing user=${format.user} database=${format.database}...`);
    const res = await test(format);
    if (res.success) {
      console.log('SUCCESS!');
      return;
    } else {
      console.log('FAILED:', res.error);
    }
  }
}

main();
