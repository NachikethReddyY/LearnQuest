import Fastify, { type FastifyError } from "fastify";
import helmet from "@fastify/helmet";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { env } from "./env.ts";
import { pool } from "./db/client.ts";
import { authRoutes } from "./auth/routes.ts";
import { lessonRoutes } from "./lessons/routes.ts";

const CODES: Record<number, string> = {
  400: "bad_request",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  429: "rate_limited",
};

export function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV === "test" ? false : { level: "info" },
    genReqId: (req) => String(req.headers["x-request-id"] ?? randomUUID()),
    trustProxy: true,
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.register(helmet);

  // Origin check instead of a CSRF token: SameSite=Lax cookies plus this hook (docs/api-plan.md §1).
  app.addHook("onRequest", async (req, reply) => {
    if (req.method === "GET" || req.method === "HEAD") return;
    if (req.headers.origin !== undefined && req.headers.origin !== env.PUBLIC_ORIGIN) {
      return reply.status(403).send({ error: { code: "forbidden", message: "Bad origin" } });
    }
  });

  app.setErrorHandler((err: FastifyError, req, reply) => {
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    if (status >= 500) req.log.error(err);
    const internal = status >= 500 && env.NODE_ENV === "production";
    reply.status(status).send({
      error: {
        code: CODES[status] ?? (status >= 500 ? "internal" : "bad_request"),
        message: internal ? "Internal error" : err.message,
      },
    });
  });

  app.setNotFoundHandler((_req, reply) =>
    reply.status(404).send({ error: { code: "not_found", message: "Route not found" } }),
  );

  app.addHook("onClose", async () => {
    await pool.end();
  });

  app.register(
    async (api) => {
      api.register(authRoutes);
      api.register(lessonRoutes);
      api.get(
        "/healthz",
        { schema: { response: { 200: z.object({ ok: z.literal(true) }) } } },
        async () => ({ ok: true as const }),
      );
      api.get(
        "/readyz",
        {
          schema: {
            response: {
              200: z.object({ ok: z.literal(true) }),
              503: z.object({ error: z.object({ code: z.string(), message: z.string() }) }),
            },
          },
        },
        async (_req, reply) => {
          try {
            await pool.query("SELECT 1");
            return { ok: true as const };
          } catch {
            return reply
              .status(503)
              .send({ error: { code: "unavailable", message: "Database unavailable" } });
          }
        },
      );
    },
    { prefix: "/api" },
  );

  return app;
}
