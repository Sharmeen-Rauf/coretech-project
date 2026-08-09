const { Client } = require("pg");
const connectionString = "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("=== CHECKING STOCK FOR CTNX-8kW-2605190167 ===");
  const res = await client.query(
    `SELECT s.*, p.name as product_name, p.brand, p.model 
     FROM public.stock s 
     LEFT JOIN public.products p ON s.product_id = p.id 
     WHERE LOWER(s.serial_no) = LOWER('CTNX-8kW-2605190167')`
  );
  console.log("STOCK QUERY RESULT:\n", JSON.stringify(res.rows, null, 2));

  await client.end();
}

main().catch(console.error);
