import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/client.ts";
import * as schema from "../db/schema.ts";
import { env } from "../env.ts";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true },
  basePath: "/api/auth",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.PUBLIC_ORIGIN],
  // shortcut: counts live in memory, so the limit is per API instance; use database storage before running more than one.
  rateLimit: {
    enabled: true,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60, max: 10 },
    },
  },
});
