const { Client } = require('pg');

const regions = [
  "ap-southeast-1", // Singapore
  "ap-south-1",     // Mumbai
  "ap-southeast-2", // Sydney
  "ap-northeast-1", // Tokyo
  "ap-northeast-2", // Seoul
  "us-east-1",      // N. Virginia
  "us-east-2",      // Ohio
  "us-west-1",      // N. California
  "us-west-2",      // Oregon
  "eu-west-1",      // Ireland
  "eu-west-2",      // London
  "eu-west-3",      // Paris
  "eu-central-1",   // Frankfurt
  "ca-central-1",   // Central Canada
  "sa-east-1",      // Sao Paulo
];

async function test(region) {
  const client = new Client({
    host: `aws-0-${region}.pooler.supabase.com`,
    user: 'postgres.cypbnnohtipwavcwukhl',
    database: 'postgres',
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
  console.log('Scanning regions via Node...');
  for (const region of regions) {
    console.log(`Testing region ${region}...`);
    const res = await test(region);
    if (res.success) {
      console.log(`SUCCESS: aws-0-${region}.pooler.supabase.com`);
      return;
    } else {
      console.log(`FAILED: ${res.error}`);
    }
  }
}

main().catch(console.error);
