import type { FastifyInstance } from "fastify";
import { env } from "../env.ts";
import { auth } from "./auth.ts";

// Better Auth's Fastify integration: forward the request as a web Request and copy the Response back.
export async function authRoutes(api: FastifyInstance) {
  api.route({
    method: ["GET", "POST"],
    url: "/auth/*",
    handler: async (req, reply) => {
      // Base comes from config, not the client's Host header.
      const url = new URL(req.url, env.BETTER_AUTH_URL);
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (v !== undefined) headers.append(k, Array.isArray(v) ? v.join(",") : v);
      }
      // Replace the client's own value: Better Auth reads this header for the rate limit key.
      headers.set("x-forwarded-for", req.ip);
      const res = await auth.handler(
        new Request(url, {
          method: req.method,
          headers,
          body: req.body ? JSON.stringify(req.body) : undefined,
        }),
      );
      reply.status(res.status);
      res.headers.forEach((v, k) => {
        if (k !== "set-cookie") reply.header(k, v);
      });
      const cookies = res.headers.getSetCookie();
      if (cookies.length) reply.header("set-cookie", cookies);
      return reply.send(res.body ? await res.text() : null);
    },
  });
}
