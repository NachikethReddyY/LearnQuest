import { eq } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db/client.ts";
import { learners } from "../db/schema.ts";
import { auth } from "./auth.ts";

declare module "fastify" {
  interface FastifyRequest {
    learnerId: string;
  }
}

export async function requireUser(req: FastifyRequest, reply: FastifyReply) {
  const session = await auth.api.getSession({ headers: new Headers(req.headers as Record<string, string>) });
  const [learner] = session
    ? await db.select({ id: learners.id }).from(learners).where(eq(learners.userId, session.user.id))
    : [];
  if (!learner) {
    return reply.status(401).send({ error: { code: "unauthorized", message: "Sign in required" } });
  }
  req.learnerId = learner.id;
}
