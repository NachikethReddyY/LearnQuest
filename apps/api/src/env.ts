import { z } from "zod";

const schema = z
  .object({
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    PUBLIC_ORIGIN: z.url().default("http://localhost:5173"),
    BETTER_AUTH_URL: z.url().optional(),
    PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    // IP or comma-separated IPs/CIDRs of the reverse proxy in front of the API. Unset: trust no forwarded address.
    TRUSTED_PROXY: z.string().optional(),
  })
  .transform((e) => ({ ...e, BETTER_AUTH_URL: e.BETTER_AUTH_URL ?? e.PUBLIC_ORIGIN }));

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  for (const issue of parsed.error.issues) {
    console.error(`env ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
