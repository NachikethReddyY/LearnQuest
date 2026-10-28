import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "../env.ts";

// Direct connection, not a transaction pooler (see docs/api-plan.md §1).
export const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
export const db = drizzle(pool);
