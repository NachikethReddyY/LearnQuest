import { signUp } from "./helpers.ts";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.ts";
import { eq, sql } from "drizzle-orm";
import { db } from "../src/db/client.ts";
import { lessons, learners, pathCourses, paths, user, worlds } from "../src/db/schema.ts";
import { streak, week } from "../src/progress/streak.ts";

const app = buildApp();
after(() => app.close());

const get = (cookie: string) => app.inject({ method: "GET", url: "/api/me/home", headers: { cookie } });
const enroll = (cookie: string, slug: string) =>
  app.inject({ method: "POST", url: `/api/paths/${slug}/enroll`, headers: { cookie } });
const answer = (cookie: string, step: string, payload: object) =>
  app.inject({ method: "POST", url: `/api/steps/${step}/attempts`, headers: { cookie }, payload });
const call = (method: "GET" | "POST" | "PATCH", url: string, cookie: string, payload?: object) =>
  app.inject({ method, url, headers: { cookie }, payload });
const userId = async (email: string) => (await db.select({ id: user.id }).from(user).where(eq(user.email, email)))[0]!.id;
const pathId = async (slug: string) => (await db.select({ id: paths.id }).from(paths).where(eq(paths.slug, slug)))[0]!.id;

test("streak counts back from today, or yesterday while today is open", () => {
  const m = new Map([["2026-10-27", 3], ["2026-10-28", 5], ["2026-10-29", 1]]);
  assert.equal(streak(m, "2026-10-29"), 2);
  m.set("2026-10-29", 3);
  assert.equal(streak(m, "2026-10-29"), 3);
  assert.equal(streak(m, "2026-10-31"), 0);
  // Crosses a month boundary.
  assert.equal(streak(new Map([["2026-10-31", 3], ["2026-11-01", 3]]), "2026-11-01"), 2);
  assert.deepEqual(week(m, "2026-10-29").map((d) => d.day)[0], "2026-10-23");
});

test("401 without login", async () => {
  assert.equal((await app.inject({ method: "GET", url: "/api/me/home" })).statusCode, 401);
});

test("new learner sees the official path and nothing to continue", async () => {
  const body = (await get(await signUp(app))).json();
  assert.equal(body.continue, null);
  assert.deepEqual(body.paths, []);
  assert.equal(body.official[0].slug, "js-foundations");
  assert.equal(body.stats.xp, 0);
  assert.equal(body.stats.streak, 0);
  assert.equal(body.stats.week.length, 7);
});

test("enroll: unknown and private paths are 404, repeat is fine", async () => {
  const cookie = await signUp(app);
  assert.equal((await enroll(cookie, "nope")).statusCode, 404);
  await db.insert(paths).values({ slug: "secret", title: "S", visibility: "private", origin: "ai" });
  assert.equal((await enroll(cookie, "secret")).statusCode, 404);
  assert.equal((await enroll(cookie, "js-foundations")).statusCode, 204);
  assert.equal((await enroll(cookie, "js-foundations")).statusCode, 204);
});

test("enrolled learner gets continue, progress and XP", async () => {
  const cookie = await signUp(app);
  await enroll(cookie, "js-foundations");
  let body = (await get(cookie)).json();
  assert.deepEqual(body.continue.lesson, { slug: "lesson-1", title: body.continue.lesson.title, level: 1, done: 0, total: 3 });
  assert.equal(body.continue.course.slug, "codequest");
  assert.deepEqual(body.official, []);

  assert.equal((await answer(cookie, "s1", { kind: "mcq", choice: 1 })).statusCode, 200);
  assert.equal((await answer(cookie, "s2", { kind: "cloze", text: "discount = 0" })).statusCode, 200);
  assert.equal((await answer(cookie, "s3", { kind: "mcq", choice: 1 })).statusCode, 200);

  body = (await get(cookie)).json();
  assert.equal(body.stats.xp, 45);
  assert.equal(body.stats.todayXp, 45);
  assert.equal(body.stats.streak, 1);
  assert.equal(body.continue, null, "only lesson is finished");
  assert.deepEqual(body.paths[0].courses[0], { slug: "codequest", title: "Shopping Cart Basics", lessonsDone: 1, lessonsTotal: 1 });
});

test("GET /api/courses/:slug: published lessons only, private courses only for the owner", async () => {
  const cookie = await signUp(app, "a@example.com");
  const otherCookie = await signUp(app, "b@example.com");
  const [codequest] = await db.select().from(worlds).where(eq(worlds.slug, "codequest"));
  await db.insert(lessons).values({ slug: "draft-1", title: "Draft", worldId: codequest!.id, sourceKind: "authored", status: "draft" });
  await db.insert(worlds).values({ slug: "b-course", title: "B Course", visibility: "private", ownerId: await userId("b@example.com"), origin: "community" });

  assert.equal((await call("GET", "/api/courses/nope", cookie)).statusCode, 404);
  assert.equal((await call("GET", "/api/courses/b-course", cookie)).statusCode, 404);

  const res = await call("GET", "/api/courses/codequest", cookie);
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.deepEqual(
    { slug: body.slug, title: body.title, description: body.description, origin: body.origin },
    { slug: "codequest", title: "Shopping Cart Basics", description: "Build a cart total, then test it.", origin: "official" },
  );
  assert.deepEqual(body.lessons.map(({ slug, level, done, total }: Record<string, number | string>) => ({ slug, level, done, total })), [
    { slug: "lesson-1", level: 1, done: 0, total: 3 },
  ]);

  await answer(cookie, "s1", { kind: "mcq", choice: 1 });
  assert.equal((await call("GET", "/api/courses/codequest", cookie)).json().lessons[0].done, 1);

  assert.equal((await call("GET", "/api/courses/b-course", otherCookie)).statusCode, 200);
});

test("GET /api/paths: scopes, enrolled flag, search and visibility", async () => {
  const cookie = await signUp(app, "a@example.com");
  const otherCookie = await signUp(app, "b@example.com");
  const otherId = await userId("b@example.com");
  await db.insert(paths).values([
    { slug: "community-one", title: "Async Patterns", origin: "community" },
    { slug: "b-private", title: "B Secret", origin: "community", visibility: "private", ownerId: otherId },
    { slug: "a-draft", title: "A Draft", origin: "community", visibility: "private", ownerId: await userId("a@example.com") },
  ]);
  const slugs = async (url: string, c = cookie) => (await call("GET", url, c)).json().map((p: { slug: string }) => p.slug);

  assert.deepEqual(await slugs("/api/paths"), ["js-foundations"]);
  assert.deepEqual(
    (await call("GET", "/api/paths", cookie)).json()[0],
    {
      slug: "js-foundations",
      title: "JavaScript Foundations",
      tagline: "Read real code and predict what it does",
      origin: "official",
      courseCount: 1,
      learners: 0,
      enrolled: false,
      courses: [{ slug: "codequest", title: "Shopping Cart Basics" }],
    },
  );
  assert.deepEqual(await slugs("/api/paths?scope=community"), ["community-one"]);
  assert.deepEqual(await slugs("/api/paths?scope=mine"), ["a-draft"]);
  assert.deepEqual((await slugs("/api/paths?scope=mine", otherCookie)).sort(), ["b-private"]);
  assert.deepEqual(await slugs("/api/paths?scope=community&q=ASYNC"), ["community-one"]);
  assert.deepEqual(await slugs("/api/paths?scope=community&q=%"), []);
  assert.equal((await call("GET", `/api/paths?q=${"x".repeat(101)}`, cookie)).statusCode, 400);

  await enroll(cookie, "js-foundations");
  const enrolled = (await call("GET", "/api/paths", cookie)).json()[0];
  assert.equal(enrolled.enrolled, true);
  assert.equal(enrolled.learners, 1);
});

test("GET /api/paths/:slug: private paths are 404 except to their owner", async () => {
  const cookie = await signUp(app, "a@example.com");
  const otherCookie = await signUp(app, "b@example.com");
  await db.insert(paths).values({ slug: "b-private", title: "B Secret", visibility: "private", ownerId: await userId("b@example.com") });

  assert.equal((await call("GET", "/api/paths/nope", cookie)).statusCode, 404);
  assert.equal((await call("GET", "/api/paths/b-private", cookie)).statusCode, 404);
  const mine = (await call("GET", "/api/paths/b-private", otherCookie)).json();
  assert.deepEqual(
    { visibility: mine.visibility, mine: mine.mine, enrolled: mine.enrolled, courses: mine.courses },
    { visibility: "private", mine: true, enrolled: false, courses: [] },
  );

  const detail = (await call("GET", "/api/paths/js-foundations", cookie)).json();
  assert.equal(detail.mine, false);
  assert.deepEqual(detail.courses, [
    { slug: "codequest", title: "Shopping Cart Basics", description: "Build a cart total, then test it.", lessonsDone: 0, lessonsTotal: 1 },
  ]);
  for (const step of ["s1", "s2", "s3"]) await answer(cookie, step, step === "s2" ? { kind: "cloze", text: "discount = 0" } : { kind: "mcq", choice: 1 });
  assert.equal((await call("GET", "/api/paths/js-foundations", cookie)).json().courses[0].lessonsDone, 1);
});

test("POST /api/paths/:slug/publish: owner only, publishes the owned courses", async () => {
  const cookie = await signUp(app, "a@example.com");
  const otherCookie = await signUp(app, "b@example.com");
  const otherId = await userId("b@example.com");
  await db.insert(paths).values({ slug: "b-private", title: "B Secret", visibility: "private", ownerId: otherId });
  const [world] = await db
    .insert(worlds)
    .values({ slug: "b-course", title: "B Course", visibility: "private", ownerId: otherId, origin: "community" })
    .returning();
  await db.insert(pathCourses).values({ pathId: await pathId("b-private"), worldId: world!.id, position: 0 });

  assert.equal((await call("POST", "/api/paths/b-private/publish", cookie)).statusCode, 404);
  assert.equal((await call("GET", "/api/paths/b-private", cookie)).statusCode, 404);
  assert.equal((await call("POST", "/api/paths/nope/publish", otherCookie)).statusCode, 404);

  assert.equal((await call("POST", "/api/paths/b-private/publish", otherCookie)).statusCode, 204);
  assert.equal((await call("GET", "/api/paths/b-private", cookie)).json().visibility, "public");
  assert.equal((await call("GET", "/api/courses/b-course", cookie)).statusCode, 200);
});

test("PATCH /api/me: validates timezone and goal, empty body is a no-op", async () => {
  const cookie = await signUp(app, "a@example.com");
  assert.equal((await call("PATCH", "/api/me", cookie, { timezone: "Mars/Olympus" })).statusCode, 400);
  assert.equal((await call("PATCH", "/api/me", cookie, { dailyGoalXp: 25 })).statusCode, 400);

  assert.equal((await call("PATCH", "/api/me", cookie, { timezone: "Asia/Kolkata", dailyGoalXp: 100 })).statusCode, 204);
  const [row] = await db.select().from(learners);
  assert.deepEqual({ timezone: row!.timezone, goal: row!.dailyGoalXp }, { timezone: "Asia/Kolkata", goal: 100 });
  assert.equal((await call("GET", "/api/me/home", cookie)).json().stats.dailyGoalXp, 100);

  assert.equal((await app.inject({ method: "PATCH", url: "/api/me", headers: { cookie, "content-type": "application/json" } })).statusCode, 204);
  assert.equal((await call("PATCH", "/api/me", cookie, { dailyGoalXp: 30 })).statusCode, 204);
  const [after] = await db.select().from(learners);
  assert.deepEqual({ timezone: after!.timezone, goal: after!.dailyGoalXp }, { timezone: "Asia/Kolkata", goal: 30 });
});

test("paths never list another user's private course", async () => {
  const cookie = await signUp(app);
  const other = await signUp(app, "b@example.com");
  const [owner] = await db.execute<{ id: string }>(sql`SELECT id FROM "user" WHERE email = 'b@example.com'`).then((r) => r.rows);
  const [hidden] = await db.insert(worlds).values({ slug: "hidden", title: "Hidden", visibility: "private", ownerId: owner!.id }).returning();
  const [jsPath] = await db.select().from(paths).where(eq(paths.slug, "js-foundations"));
  await db.insert(pathCourses).values({ pathId: jsPath!.id, worldId: hidden!.id, position: 1 });
  await enroll(cookie, "js-foundations");

  const home = (await get(cookie)).json();
  assert.deepEqual(home.paths[0].courses.map((c: { slug: string }) => c.slug), ["codequest"]);
  const list = (await app.inject({ method: "GET", url: "/api/paths", headers: { cookie } })).json();
  assert.deepEqual(list[0].courses.map((c: { slug: string }) => c.slug), ["codequest"]);
  assert.equal(list[0].courseCount, 1);
  const detail = (await app.inject({ method: "GET", url: "/api/paths/js-foundations", headers: { cookie } })).json();
  assert.equal(detail.courses.length, 1);
  // The owner still sees it.
  const mine = (await app.inject({ method: "GET", url: "/api/paths/js-foundations", headers: { cookie: other } })).json();
  assert.equal(mine.courses.length, 2);
});
