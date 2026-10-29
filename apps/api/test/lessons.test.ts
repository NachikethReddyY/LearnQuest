import { code, out, signUp, trpc } from "./helpers.ts";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { buildApp } from "../src/app.ts";
import { db } from "../src/db/client.ts";
import { lessons } from "../src/db/schema.ts";

const app = buildApp();
after(() => app.close());

const FORBIDDEN = ["secret", "answer", "accepted", "hints", "hunks", "beforeFiles", "explanations", "source"];
function walk(v: unknown) {
  if (Array.isArray(v)) return v.forEach(walk);
  if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) {
      assert.ok(!FORBIDDEN.includes(k), `leaked key ${k}`);
      walk(x);
    }
  }
}

test("401 without login", async () => {
  const res = await trpc(app).q("lessons.get", { id: "lesson-1" });
  assert.equal(res.statusCode, 401);
  assert.equal(code(res), "UNAUTHORIZED");
});

test("200 shape, by slug and by id, with no secret keys", async () => {
  const t = trpc(app, await signUp(app));
  const res = await t.q("lessons.get", { id: "lesson-1" });
  assert.equal(res.statusCode, 200);
  const body = out(res);
  assert.equal(body.id, "lesson-1");
  assert.equal(body.steps.length, 3);
  assert.deepEqual(body.steps[0], { id: "s1", idx: 0, title: "Add a cartTotal function", hintCount: 2, state: "predicting" });
  walk(res.json());

  const [row] = await db.select().from(lessons).where(eq(lessons.slug, "lesson-1"));
  const byId = await t.q("lessons.get", { id: row!.id });
  assert.deepEqual(out(byId), body);
});

test("unpublished lesson and unknown id are 404", async () => {
  const t = trpc(app, await signUp(app));
  await db.update(lessons).set({ status: "draft" }).where(eq(lessons.slug, "lesson-1"));
  for (const id of ["lesson-1", "nope"]) {
    const res = await t.q("lessons.get", { id });
    assert.equal(res.statusCode, 404);
    assert.equal(code(res), "NOT_FOUND");
  }
});
