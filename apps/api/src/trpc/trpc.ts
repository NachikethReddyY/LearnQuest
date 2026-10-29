import { initTRPC, TRPCError } from "@trpc/server";
import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { resolveLearnerId } from "../auth/guards.ts";

export const createContext = ({ req }: CreateFastifyContextOptions) => ({ req });

const t = initTRPC.context<ReturnType<typeof createContext>>().create({
  isDev: false, // never send stack traces
  errorFormatter: ({ shape, error }) => {
    // Mirrors app.ts: an unset NODE_ENV counts as production, so internal errors are not echoed there.
    const devLike = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
    return error.code === "INTERNAL_SERVER_ERROR" && !devLike ? { ...shape, message: "Internal error" } : shape;
  },
});

export const router = t.router;

// Auth runs before any .input() that a procedure adds, so a bad body without a session is still UNAUTHORIZED.
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  const learnerId = await resolveLearnerId(ctx.req.headers);
  if (!learnerId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in required" });
  return next({ ctx: { learnerId } });
});
