import { trpc } from "./helpers.ts";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.ts";

const app = buildApp();
after(() => app.close());

test("GET /api/healthz returns ok", async () => {
  const res = await app.inject({ method: "GET", url: "/api/healthz" });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { ok: true });
});

test("GET /api/readyz returns ok when the database is up", async () => {
  const res = await app.inject({ method: "GET", url: "/api/readyz" });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { ok: true });
});

test("unknown route returns a 404 in the error shape", async () => {
  const res = await app.inject({ method: "GET", url: "/api/nope" });
  assert.equal(res.statusCode, 404);
  assert.equal(res.json().error.code, "not_found");
  assert.equal(typeof res.json().error.message, "string");
});

test("POST with a foreign Origin is rejected with 403", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/healthz",
    headers: { origin: "https://evil.test" },
  });
  assert.equal(res.statusCode, 403);
  assert.equal(res.json().error.code, "forbidden");
});

test("tRPC mutation with a foreign Origin is rejected with 403, a matching Origin gets through to auth", async () => {
  const t = trpc(app);
  const bad = await t.m("me.update", {}, { origin: "https://evil.test" });
  assert.equal(bad.statusCode, 403);
  assert.equal(bad.json().error.code, "forbidden");
  const ok = await t.m("me.update", {}, { origin: process.env.PUBLIC_ORIGIN ?? "http://localhost:5173" });
  assert.equal(ok.statusCode, 401);
});

test("tRPC rejects a mutation sent as GET", async () => {
  const res = await app.inject({ method: "GET", url: "/api/trpc/me.update" });
  assert.equal(res.statusCode, 405);
});
