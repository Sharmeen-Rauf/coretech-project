import { NextResponse } from "next/server";
import { Client } from "pg";
import dns from "dns";

export async function GET() {
  const log: string[] = [];
  log.push("Starting database connectivity test...");

  // 1. Resolve host
  const host = "db.cypbnnohtipwavcwukhl.supabase.co";
  log.push(`Resolving hostname: ${host}`);
  try {
    const lookup = await new Promise<{ address: string; family: number }>((resolve, reject) => {
      dns.lookup(host, { all: false }, (err, address, family) => {
        if (err) reject(err);
        else resolve({ address, family });
      });
    });
    log.push(`DNS Resolved: address=${lookup.address}, family=${lookup.family}`);
  } catch (dnsErr: any) {
    log.push(`DNS Resolution failed: ${dnsErr.message}`);
  }

  // 2. Connect via pg
  const connStr = process.env.DATABASE_URL || "postgresql://postgres:munifpaisedega@db.cypbnnohtipwavcwukhl.supabase.co:5432/postgres";
  log.push(`Connecting via connection string: ${connStr.replace(/:[^:@]+@/, ":****@")}`);
  
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    log.push("Successfully connected to PostgreSQL database!");
    
    // Check columns
    const columnsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'installer_jobs';
    `);
    log.push(`Columns in installer_jobs: ${columnsRes.rows.map((r: any) => `${r.column_name}(${r.data_type})`).join(", ")}`);
    
    // Reload schema
    log.push("Sending NOTIFY pgrst, 'reload schema'...");
    await client.query("NOTIFY pgrst, 'reload schema';");
    log.push("Schema reload notification sent successfully!");
    
    await client.end();
    return NextResponse.json({ success: true, log });
  } catch (dbErr: any) {
    log.push(`Database connection/query failed: ${dbErr.message}`);
    try {
      await client.end();
    } catch {}
    return NextResponse.json({ success: false, log });
  }
}
