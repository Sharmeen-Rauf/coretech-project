const { Client } = require("pg");
const connectionString = "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("=== CHECKING AUTH USER & PROFILE ===");
  
  // Find in auth.users
  const authUser = await client.query(`
    SELECT id, email, created_at, last_sign_in_at
    FROM auth.users
    WHERE email = 'sharmeentesting@gmail.com';
  `);
  console.log("Auth User Details:\n", JSON.stringify(authUser.rows, null, 2));

  if (authUser.rows.length > 0) {
    const userId = authUser.rows[0].id;
    // Find in public.profiles
    const profile = await client.query(`
      SELECT id, first_name, last_name, role, status
      FROM public.profiles
      WHERE id = $1;
    `, [userId]);
    console.log("Public Profile Details:\n", JSON.stringify(profile.rows, null, 2));
  } else {
    console.log("No user found in auth.users with email sharmeentesting@gmail.com");
  }

  await client.end();
}

main().catch(console.error);
