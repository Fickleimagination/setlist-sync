/**
 * Runs db/001_schema.sql against DATABASE_URL.
 * Run with: npm run db:migrate
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "fs";
import { join } from "path";
import { Pool } from "pg";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = readFileSync(join(process.cwd(), "db", "001_schema.sql"), "utf-8");
  try {
    await pool.query(sql);
    console.log("Schema migration applied successfully.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
