const { Client } = require("pg");
const connectionString = "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("=== CHECKING USER installertesting@gmail.com ===");
  
  const authUser = await client.query(`
    SELECT id, email, created_at, last_sign_in_at
    FROM auth.users
    WHERE email = 'installertesting@gmail.com';
  `);
  console.log("Auth User:", JSON.stringify(authUser.rows, null, 2));

  if (authUser.rows.length > 0) {
    const userId = authUser.rows[0].id;
    const profile = await client.query(`
      SELECT id, first_name, last_name, role, status
      FROM public.profiles
      WHERE id = $1;
    `, [userId]);
    console.log("Profile:", JSON.stringify(profile.rows, null, 2));
  } else {
    console.log("User not found!");
  }

  await client.end();
}

main().catch(console.error);
