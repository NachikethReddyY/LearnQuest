import { eq } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db/client.ts";
import { learners } from "../db/schema.ts";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.ts";

declare module "fastify" {
  interface FastifyRequest {
    learnerId: string;
  }
}

export async function requireUser(req: FastifyRequest, reply: FastifyReply) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    return reply.status(401).send({ error: { code: "unauthorized", message: "Sign in required" } });
  }
  const find = () => db.select({ id: learners.id }).from(learners).where(eq(learners.userId, session.user.id));
  let [learner] = await find();
  if (!learner) {
    // Created on first authenticated request; learners.userId is unique, so a concurrent insert is a no-op.
    await db.insert(learners).values({ userId: session.user.id }).onConflictDoNothing();
    [learner] = await find();
  }
  req.learnerId = learner!.id;
}
