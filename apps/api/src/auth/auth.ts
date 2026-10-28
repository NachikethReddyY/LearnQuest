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
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await db.insert(schema.learners).values({ userId: user.id });
        },
      },
    },
  },
});
