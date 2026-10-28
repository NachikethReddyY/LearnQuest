import { signUp } from "./helpers.ts";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { buildApp } from "../src/app.ts";
import { db } from "../src/db/client.ts";
import { attempts } from "../src/db/schema.ts";

const app = buildApp();
after(() => app.close());

const FORBIDDEN = ["secret", "answer", "accepted", "hunks", "explanations", "source"];
function walk(v: unknown, path = "") {
  if (Array.isArray(v)) return v.forEach((x) => walk(x, path));
  if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) {
      assert.ok(!FORBIDDEN.includes(k), `leaked key ${k}`);
      walk(x, `${path}.${k}`);
    }
  }
}

const call = (cookie: string, method: "GET" | "POST", url: string, payload?: object) =>
  app.inject({ method, url: `/api/steps/${url}`, headers: { cookie }, payload });
const mcq = (cookie: string, choice: number) => call(cookie, "POST", "s1/attempts", { kind: "mcq", choice });
// s1 answer is index 1.

test("401 without login", async () => {
  for (const [m, u] of [["GET", "s1"], ["POST", "s1/attempts"], ["POST", "s1/hints"], ["POST", "s1/skip"], ["GET", "s1/reveal"]] as const) {
    const payload = u.endsWith("attempts") ? { kind: "mcq", choice: 0 } : undefined;
    const res = await app.inject({ method: m, url: `/api/steps/${u}`, payload });
    assert.equal(res.statusCode, 401, u);
  }
});

test("full MCQ path ends revealed after a failed retry", async () => {
  const c = await signUp(app);
  const first = (await call(c, "GET", "s1")).json();
  assert.equal(first.kind, "mcq");
  assert.equal(first.options.length, 4);
  assert.deepEqual(first.hints, []);
  assert.equal((await call(c, "GET", "s1/reveal")).statusCode, 409);

  let r = (await mcq(c, 0)).json();
  assert.deepEqual([r.correct, r.state, r.attemptAllowed, r.hintsUsed, r.feedback], [false, "hinting", false, 0, "Not quite."]);
  assert.equal((await mcq(c, 0)).statusCode, 409);

  let h = (await call(c, "POST", "s1/hints")).json();
  assert.equal(h.rung, 1);
  assert.equal(h.eliminate, 3);
  walk(h);
  r = (await mcq(c, 0)).json();
  assert.deepEqual([r.state, r.attemptAllowed, r.hintsUsed], ["hinting", false, 1]);

  h = (await call(c, "POST", "s1/hints")).json();
  assert.equal(h.rung, 2);
  assert.equal("eliminate" in h, false);
  walk(h);
  assert.equal((await call(c, "POST", "s1/hints")).statusCode, 409);

  const mid = (await call(c, "GET", "s1")).json();
  walk(mid);
  assert.equal(mid.hints.length, 2);
  assert.equal(mid.rungsTaken, 2);

  r = (await mcq(c, 2)).json();
  assert.deepEqual([r.state, r.attemptAllowed], ["hinting", true]); // retry offered
  r = (await mcq(c, 2)).json();
  assert.equal(r.state, "revealed");
  assert.equal((await mcq(c, 1)).statusCode, 409);

  const rev = await call(c, "GET", "s1/reveal");
  assert.equal(rev.statusCode, 200);
  assert.deepEqual(rev.json().answer, { type: "mcq", index: 1 });
  assert.equal(rev.json().explanations.inferred, true);

  const rows = await db.select().from(attempts).where(eq(attempts.stepId, "s1"));
  assert.equal(rows.filter((x) => x.observed).length, 1);
  assert.equal(rows.length, 4);
});

test("correct first try", async () => {
  const c = await signUp(app);
  const r = (await mcq(c, 1)).json();
  assert.deepEqual([r.correct, r.state, r.feedback, r.hintsUsed], [true, "revealed", "Correct!", 0]);
  assert.equal((await call(c, "GET", "s1/reveal")).statusCode, 200);
  assert.equal((await call(c, "POST", "s1/skip")).statusCode, 409);
});

test("skip, then reveal", async () => {
  const c = await signUp(app);
  assert.equal((await call(c, "GET", "s1/reveal")).statusCode, 409);
  const res = await call(c, "POST", "s1/skip");
  assert.deepEqual(res.json(), { state: "skipped" });
  assert.equal((await call(c, "GET", "s1/reveal")).statusCode, 200);
  const [row] = await db.select().from(attempts).where(eq(attempts.stepId, "s1"));
  assert.deepEqual([row!.kind, row!.correct, row!.observed], ["skip", null, true]);
});

test("cloze grading and body validation", async () => {
  const c = await signUp(app);
  assert.equal((await call(c, "POST", "s2/attempts", { kind: "mcq", choice: 0 })).statusCode, 400);
  assert.equal((await call(c, "POST", "s1/attempts", { kind: "cloze", text: "x" })).statusCode, 400);
  assert.equal((await call(c, "POST", "s2/attempts", { kind: "cloze", text: "x".repeat(201) })).statusCode, 400);
  assert.equal((await call(c, "POST", "s1/attempts", { kind: "mcq", choice: 4 })).statusCode, 400);
  const r = (await call(c, "POST", "s2/attempts", { kind: "cloze", text: " discount=0 " })).json();
  assert.equal(r.correct, true);
  assert.deepEqual((await call(c, "GET", "s2/reveal")).json().answer, { type: "cloze", text: "discount = 0" });
});

test("unknown step is 404", async () => {
  const c = await signUp(app);
  assert.equal((await call(c, "GET", "nope")).statusCode, 404);
});

test("20 parallel identical attempts yield one observed row", async () => {
  const c = await signUp(app);
  const res = await Promise.all(Array.from({ length: 20 }, () => mcq(c, 0)));
  assert.equal(res.filter((r) => r.statusCode === 200).length, 1);
  assert.equal(res.filter((r) => r.statusCode === 409).length, 19);
  const rows = await db.select().from(attempts).where(and(eq(attempts.stepId, "s1"), eq(attempts.observed, true)));
  assert.equal(rows.length, 1);
});

test("a second learner's progress is independent", async () => {
  const a = await signUp(app, "a@example.com");
  const b = await signUp(app, "b@example.com");
  await mcq(a, 1);
  assert.equal((await call(a, "GET", "s1")).json().state, "revealed");
  assert.equal((await call(b, "GET", "s1")).json().state, "predicting");
  assert.equal((await call(b, "GET", "s1/reveal")).statusCode, 409);
  assert.equal((await mcq(b, 0)).json().state, "hinting");
});

test("leak walk on a fresh step", async () => {
  const c = await signUp(app);
  for (const id of ["s1", "s2", "s3"]) walk((await call(c, "GET", id)).json());
});

test("malformed step id is 400, not 500", async () => {
  const c = await signUp(app);
  assert.equal((await call(c, "GET", "%00")).statusCode, 400);
});

test("auth runs before validation: no cookie + bad body is 401", async () => {
  const res = await call("", "POST", "s1/attempts", { kind: "x" });
  assert.equal(res.statusCode, 401);
});

test("empty JSON body with the JSON content-type is accepted", async () => {
  const c = await signUp(app);
  const res = await app.inject({
    method: "POST",
    url: "/api/steps/s1/hints",
    headers: { cookie: c, "content-type": "application/json" },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().rung, 1);
});

test("JSON with a __proto__ key is rejected", async () => {
  const c = await signUp(app);
  const res = await app.inject({
    method: "POST",
    url: "/api/steps/s1/attempts",
    headers: { cookie: c, "content-type": "application/json" },
    payload: '{"kind":"mcq","choice":0,"__proto__":{"x":1}}',
  });
  assert.equal(res.statusCode, 400);
});
