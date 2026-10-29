import { eq } from "drizzle-orm";
import type { IncomingHttpHeaders } from "node:http";
import { db } from "../db/client.ts";
import { learners } from "../db/schema.ts";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.ts";

// Returns the signed-in learner's id (creating the learner row on first use), or null without a session.
export async function resolveLearnerId(headers: IncomingHttpHeaders): Promise<string | null> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(headers) });
  if (!session) return null;
  const find = () => db.select({ id: learners.id }).from(learners).where(eq(learners.userId, session.user.id));
  let [learner] = await find();
  if (!learner) {
    // Created on first authenticated request; learners.userId is unique, so a concurrent insert is a no-op.
    await db.insert(learners).values({ userId: session.user.id }).onConflictDoNothing();
    [learner] = await find();
  }
  return learner!.id;
}
