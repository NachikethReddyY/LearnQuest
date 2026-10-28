import { and, count, eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { requireUser } from "../auth/guards.ts";
import { db } from "../db/client.ts";
import { attempts, hintEvents, lessons, lessonVersions, stepProgress, steps } from "../db/schema.ts";
import { withTx } from "../db/tx.ts";
import { gradeCloze } from "../grading/cloze.ts";
import { gradeMcq } from "../grading/mcq.ts";
import { fresh, next, type Action, type Progress } from "./machine.ts";

const ErrorBody = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
const Id = z.object({ id: z.string().regex(/^[\w-]{1,64}$/) });
const State = z.enum(["predicting", "hinting", "revealed", "skipped"]);
const Hint = z.object({ rung: z.number(), text: z.string(), eliminate: z.number().optional() });
const Body = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("mcq"), choice: z.number().int().min(0).max(3) }),
  z.object({ kind: z.literal("cloze"), text: z.string().max(200) }),
]);

const fail = (reply: FastifyReply, status: number, code: string, message: string) =>
  reply.status(status).send({ error: { code, message } });
const notFound = (reply: FastifyReply) => fail(reply, 404, "not_found", "Step not found");

async function loadStep(id: string) {
  const [row] = await db
    .select({ id: steps.id, idx: steps.idx, pub: steps.public, secret: steps.secret, source: lessons.source })
    .from(steps)
    .innerJoin(lessonVersions, eq(lessonVersions.id, steps.lessonVersionId))
    .innerJoin(lessons, eq(lessons.id, lessonVersions.lessonId))
    .where(and(eq(steps.id, id), eq(lessons.status, "published")));
  return row;
}
type Step = NonNullable<Awaited<ReturnType<typeof loadStep>>>;

const hintAt = (step: Step, rung: number) => {
  const h = step.secret.hints[rung - 1]!;
  // Eliminate is only meaningful on MCQ rung 1.
  const eliminate = step.pub.kind === "mcq" && rung === 1 ? h.eliminate : undefined;
  return { rung, text: h.text, ...(eliminate !== undefined && { eliminate }) };
};

async function readProgress(learnerId: string, stepId: string): Promise<Progress> {
  const [p] = await db
    .select()
    .from(stepProgress)
    .where(and(eq(stepProgress.learnerId, learnerId), eq(stepProgress.stepId, stepId)));
  return p ?? fresh();
}

// Serialised per (learner, step) by the row lock, so parallel identical requests can't both be "first".
function mutate(
  learnerId: string,
  step: Step,
  action: Action,
  response: { kind: "mcq" | "cloze"; choice?: number; text?: string } | null,
) {
  const stepId = step.id;
  return withTx(async (tx) => {
    await tx.insert(stepProgress).values({ learnerId, stepId }).onConflictDoNothing();
    const where = and(eq(stepProgress.learnerId, learnerId), eq(stepProgress.stepId, stepId));
    const [p] = await tx.select().from(stepProgress).where(where).for("update");
    const r = next(p!, action, { hintCount: step.secret.hints.length });
    if ("conflict" in r) return r;

    await tx.update(stepProgress).set({ ...r.progress, updatedAt: new Date() }).where(where);
    const o = r.outcome;
    let attemptId: string | undefined;
    if (o.type === "hint") {
      await tx.insert(hintEvents).values({ learnerId, stepId, rung: o.rung });
    } else {
      const [{ n }] = await tx
        .select({ n: count() })
        .from(attempts)
        .where(and(eq(attempts.learnerId, learnerId), eq(attempts.stepId, stepId)));
      const [row] = await tx
        .insert(attempts)
        .values({
          learnerId,
          stepId,
          kind: o.type === "skip" ? "skip" : response!.kind,
          response: o.type === "skip" ? null : response,
          observed: n === 0,
          correct: o.type === "skip" ? null : o.correct,
          hintsUsed: r.progress.rungsTaken,
          feedback: o.type === "skip" ? null : o.correct ? "Correct!" : "Not quite.",
        })
        .returning({ id: attempts.id });
      attemptId = row!.id;
    }
    return { ...r, attemptId };
  });
}

export async function attemptRoutes(api: FastifyInstance) {
  const r = api.withTypeProvider<ZodTypeProvider>();
  const base = { onRequest: requireUser };

  r.get(
    "/steps/:id",
    {
      ...base,
      schema: {
        params: Id,
        response: {
          200: z.object({
            id: z.string(),
            idx: z.number(),
            title: z.string(),
            prompt: z.string(),
            kind: z.enum(["mcq", "cloze"]),
            options: z.array(z.string()).optional(),
            hintCount: z.number(),
            state: State,
            rungsTaken: z.number(),
            attemptAllowed: z.boolean(),
            hints: z.array(Hint),
            beforeFiles: z.record(z.string(), z.string()),
          }),
          404: ErrorBody,
        },
      },
    },
    async (req, reply) => {
      const step = await loadStep(req.params.id);
      if (!step) return notFound(reply);
      const p = await readProgress(req.learnerId, step.id);
      return {
        id: step.id,
        idx: step.idx,
        title: step.pub.title,
        prompt: step.pub.prompt,
        kind: step.pub.kind,
        ...(step.pub.options && { options: step.pub.options }),
        hintCount: step.secret.hints.length,
        state: p.state,
        rungsTaken: p.rungsTaken,
        attemptAllowed: p.attemptAllowed,
        hints: Array.from({ length: p.rungsTaken }, (_, i) => hintAt(step, i + 1)),
        beforeFiles: step.secret.beforeFiles,
      };
    },
  );

  r.post(
    "/steps/:id/attempts",
    {
      ...base,
      schema: {
        params: Id,
        body: Body,
        response: {
          200: z.object({
            attemptId: z.string(),
            correct: z.boolean(),
            feedback: z.string(),
            missedConcepts: z.array(z.string()),
            hintsUsed: z.number(),
            state: State,
            attemptAllowed: z.boolean(),
          }),
          400: ErrorBody,
          404: ErrorBody,
          409: ErrorBody,
        },
      },
    },
    async (req, reply) => {
      const step = await loadStep(req.params.id);
      if (!step) return notFound(reply);
      const b = req.body;
      if (b.kind !== step.pub.kind) return fail(reply, 400, "bad_request", `kind must be ${step.pub.kind}`);
      const { answer, accepted } = step.secret;
      const correct =
        b.kind === "mcq" ? gradeMcq(b.choice, answer as number) : gradeCloze(b.text, answer as string, accepted ?? []);
      const out = await mutate(req.learnerId, step, { type: "attempt", correct }, b);
      if ("conflict" in out) return fail(reply, 409, "conflict", out.conflict);
      return {
        attemptId: out.attemptId!,
        correct,
        feedback: correct ? "Correct!" : "Not quite.",
        missedConcepts: [],
        hintsUsed: out.progress.rungsTaken,
        state: out.progress.state,
        attemptAllowed: out.progress.attemptAllowed,
      };
    },
  );

  r.post(
    "/steps/:id/hints",
    { ...base, schema: { params: Id, response: { 200: Hint, 404: ErrorBody, 409: ErrorBody } } },
    async (req, reply) => {
      const step = await loadStep(req.params.id);
      if (!step) return notFound(reply);
      const out = await mutate(req.learnerId, step, { type: "hint" }, null);
      if ("conflict" in out) return fail(reply, 409, "conflict", out.conflict);
      return hintAt(step, out.progress.rungsTaken);
    },
  );

  r.post(
    "/steps/:id/skip",
    {
      ...base,
      schema: { params: Id, response: { 200: z.object({ state: z.literal("skipped") }), 404: ErrorBody, 409: ErrorBody } },
    },
    async (req, reply) => {
      const step = await loadStep(req.params.id);
      if (!step) return notFound(reply);
      const out = await mutate(req.learnerId, step, { type: "skip" }, null);
      if ("conflict" in out) return fail(reply, 409, "conflict", out.conflict);
      return { state: "skipped" as const };
    },
  );

  r.get(
    "/steps/:id/reveal",
    {
      ...base,
      schema: {
        params: Id,
        response: {
          200: z.object({
            answer: z.discriminatedUnion("type", [
              z.object({ type: z.literal("mcq"), index: z.number() }),
              z.object({ type: z.literal("cloze"), text: z.string() }),
            ]),
            hunks: z.array(z.unknown()),
            explanations: z.object({ workedExample: z.string(), practice: z.string(), inferred: z.literal(true) }),
            source: z.object({ repo: z.string(), sha: z.string(), path: z.string() }),
          }),
          404: ErrorBody,
          409: ErrorBody,
        },
      },
    },
    async (req, reply) => {
      const step = await loadStep(req.params.id);
      if (!step) return notFound(reply);
      const { state } = await readProgress(req.learnerId, step.id);
      if (state !== "revealed" && state !== "skipped") return fail(reply, 409, "conflict", "Not revealed yet");
      const s = step.secret;
      return {
        answer:
          step.pub.kind === "mcq"
            ? { type: "mcq" as const, index: s.answer as number }
            : { type: "cloze" as const, text: s.answer as string },
        hunks: s.hunks,
        explanations: { ...s.explanations, inferred: true as const },
        source: step.source!,
      };
    },
  );
}
