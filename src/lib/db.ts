import { Pool } from "pg";

// Single shared connection pool. DATABASE_URL comes from env vars only —
// never hard-code credentials here (DBMS Level 3 requirement #10).
declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

export const pool =
  global.__pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  global.__pgPool = pool;
}

/** Run a single parameterized query. */
export async function query<T = unknown>(text: string, params?: unknown[]) {
  const result = await pool.query<T>(text, params);
  return result;
}

/**
 * Run a callback inside a transaction. Commits on success, rolls back
 * and rethrows on any error. Use for any multi-statement write that must
 * be atomic (e.g. logging a play + touching derived state together).
 */
export async function withTransaction<T>(
  fn: (client: import("pg").PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
