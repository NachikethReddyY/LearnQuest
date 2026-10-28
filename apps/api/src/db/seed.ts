import { eq } from "drizzle-orm";
import lesson1 from "../../../web/src/player/fixtures/lesson1.ts";
import { db, pool } from "./client.ts";
import { lessons, lessonVersions, steps, worlds } from "./schema.ts";

// shortcut: seeds from the web fixture, switch to reading worlds/codequest JSON once WP11 content exists.
export async function seed() {
  await db.transaction(async (tx) => {
    await tx.insert(worlds).values({ slug: "codequest" }).onConflictDoNothing();
    const [world] = await tx.select().from(worlds).where(eq(worlds.slug, "codequest"));

    await tx
      .insert(lessons)
      .values({
        slug: "lesson-1",
        worldId: world!.id,
        title: lesson1.title,
        sourceKind: "repo",
        source: lesson1.source,
        status: "published",
      })
      .onConflictDoUpdate({
        target: lessons.slug,
        set: { title: lesson1.title, source: lesson1.source, status: "published" },
      });
    const [lesson] = await tx.select().from(lessons).where(eq(lessons.slug, "lesson-1"));

    await tx
      .insert(lessonVersions)
      .values({ lessonId: lesson!.id, version: 1, publishedAt: new Date() })
      .onConflictDoNothing();
    const [version] = await tx
      .select()
      .from(lessonVersions)
      .where(eq(lessonVersions.lessonId, lesson!.id));
    await tx.update(lessons).set({ currentVersionId: version!.id }).where(eq(lessons.id, lesson!.id));

    for (const s of lesson1.steps) {
      const values = {
        // shortcut: fixture ids (s1..s3) are the step ids so the web contract holds, upgrade to uuids with real content.
        id: s.id,
        lessonVersionId: version!.id,
        idx: s.idx,
        public: {
          title: s.title,
          prompt: s.prompt,
          kind: s.kind,
          ...(s.options ? { options: s.options } : {}),
        },
        secret: {
          beforeFiles: s.input.beforeFiles,
          hunks: s.input.hunks,
          answer: s.answer,
          ...(s.accepted ? { accepted: s.accepted } : {}),
          hints: s.hints,
          explanations: s.explanations,
        },
      };
      await tx
        .insert(steps)
        .values(values)
        .onConflictDoUpdate({ target: steps.id, set: values });
    }
  });
}

if (import.meta.main) {
  await seed();
  await pool.end();
}
