import { drizzle } from "drizzle-orm/node-postgres";
import type { PoolClient } from "pg";
import { pool, type Db } from "./client.ts";
import * as schema from "./schema.ts";

export async function withTx<T>(fn: (db: Db, client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(drizzle(client, { schema }) as unknown as Db, client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
