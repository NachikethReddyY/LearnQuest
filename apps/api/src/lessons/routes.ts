import { and, asc, eq, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { requireUser } from "../auth/guards.ts";
import { db } from "../db/client.ts";
import { lessons, stepProgress, steps } from "../db/schema.ts";

const Lesson = z.object({
  id: z.string(),
  title: z.string(),
  steps: z.array(
    z.object({
      id: z.string(),
      idx: z.number(),
      title: z.string(),
      hintCount: z.number(),
      state: z.enum(["predicting", "hinting", "revealed", "skipped"]),
    }),
  ),
});

const ErrorBody = z.object({ error: z.object({ code: z.string(), message: z.string() }) });

export async function lessonRoutes(api: FastifyInstance) {
  api.withTypeProvider<ZodTypeProvider>().get(
    "/lessons/:id",
    {
      preHandler: requireUser,
      schema: { params: z.object({ id: z.string() }), response: { 200: Lesson, 404: ErrorBody } },
    },
    async (req, reply) => {
      const { id } = req.params;
      const [lesson] = await db
        .select()
        .from(lessons)
        .where(and(or(eq(lessons.id, id), eq(lessons.slug, id)), eq(lessons.status, "published")));
      if (!lesson?.currentVersionId) {
        return reply.status(404).send({ error: { code: "not_found", message: "Lesson not found" } });
      }
      const rows = await db
        .select({ id: steps.id, idx: steps.idx, pub: steps.public, hintCount: sql<number>`jsonb_array_length(${steps.secret}->'hints')`, state: stepProgress.state })
        .from(steps)
        .leftJoin(
          stepProgress,
          and(eq(stepProgress.stepId, steps.id), eq(stepProgress.learnerId, req.learnerId)),
        )
        .where(eq(steps.lessonVersionId, lesson.currentVersionId))
        .orderBy(asc(steps.idx));
      return {
        id: lesson.slug,
        title: lesson.title,
        steps: rows.map((r) => ({
          id: r.id,
          idx: r.idx,
          title: r.pub.title,
          hintCount: r.hintCount,
          state: r.state ?? "predicting",
        })),
      };
    },
  );
}
