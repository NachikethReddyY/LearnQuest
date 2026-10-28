import { PASSWORD, signUp } from "./helpers.ts";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.ts";

const app = buildApp();
after(() => app.close());

test("sign-up, session, sign-out, then protected route is 401", async () => {
  const cookie = await signUp(app);
  const ok = await app.inject({ method: "GET", url: "/api/lessons/lesson-1", headers: { cookie } });
  assert.equal(ok.statusCode, 200);

  const session = await app.inject({ method: "GET", url: "/api/auth/get-session", headers: { cookie } });
  assert.equal(session.json().user.email, "a@example.com");

  const out = await app.inject({ method: "POST", url: "/api/auth/sign-out", headers: { cookie }, payload: {} });
  assert.equal(out.statusCode, 200);

  const after = await app.inject({ method: "GET", url: "/api/lessons/lesson-1", headers: { cookie } });
  assert.equal(after.statusCode, 401);
  assert.equal(after.json().error.code, "unauthorized");
});

test("session cookie is httpOnly", async () => {
  await signUp(app);
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/sign-in/email",
    payload: { email: "a@example.com", password: PASSWORD },
  });
  const c = res.cookies.find((x) => x.name.includes("session_token"));
  assert.ok(c);
  assert.equal(c.httpOnly, true);
});

test("wrong password fails", async () => {
  await signUp(app);
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/sign-in/email",
    payload: { email: "a@example.com", password: "nope-nope-nope" },
  });
  assert.equal(res.statusCode, 401);
  assert.equal(res.cookies.length, 0);
});
