import { signUp } from "./helpers.ts";
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
  const res = await app.inject({ method: "GET", url: "/api/lessons/lesson-1" });
  assert.equal(res.statusCode, 401);
});

test("200 shape, by slug and by id, with no secret keys", async () => {
  const cookie = await signUp(app);
  const res = await app.inject({ method: "GET", url: "/api/lessons/lesson-1", headers: { cookie } });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.id, "lesson-1");
  assert.equal(body.steps.length, 3);
  assert.deepEqual(body.steps[0], { id: "s1", idx: 0, title: "Add a cartTotal function", hintCount: 2, state: "predicting" });
  walk(body);

  const [row] = await db.select().from(lessons).where(eq(lessons.slug, "lesson-1"));
  const byId = await app.inject({ method: "GET", url: `/api/lessons/${row!.id}`, headers: { cookie } });
  assert.deepEqual(byId.json(), body);
});

test("unpublished lesson and unknown id are 404", async () => {
  const cookie = await signUp(app);
  await db.update(lessons).set({ status: "draft" }).where(eq(lessons.slug, "lesson-1"));
  for (const id of ["lesson-1", "nope"]) {
    const res = await app.inject({ method: "GET", url: `/api/lessons/${id}`, headers: { cookie } });
    assert.equal(res.statusCode, 404);
  }
});
