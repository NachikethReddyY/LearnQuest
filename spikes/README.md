# WP0 spikes (throwaway)

Plan: `docs/plan.md` §16 WP0. Each spike is separate; none is imported by the app.

| Spike | Result | Next |
|---|---|---|
| [`pgboss-enqueue/`](pgboss-enqueue/) | **Pass locally** on Postgres 16. Enqueue inside the app's transaction: rollback drops the job, commit publishes it, the job is invisible before commit, and a `singletonKey` dedupes a retry. | Needs `policy: 'short'` on the queue. Without it, `singletonKey` does not dedupe. |
| [`sse-rewrite/`](sse-rewrite/) | **Local leg only.** The probe reads a 20 s stream from a local origin. The Vercel rewrite is not tested. | Needs a public origin and a Vercel preview deploy. Decision needed from the owner. |
| [`litellm-advisory/`](litellm-advisory/) | **Pin 1.106.2.** 1.107.0 (Oct 21 2026) and 1.82.7/1.82.8 (Mar 2026) were compromised and are gone from PyPI. | Hash-lock the pin in WP2. Do not use 1.106.3–1.106.5 until LiteLLM confirms them. |

Hosting pricing (the fourth WP0 item) is not covered by these spikes.

Run the pg-boss spike against a local Postgres:

```bash
docker run -d --name lq-spike-pg -e POSTGRES_PASSWORD=spike -e POSTGRES_DB=spike -p 54329:5432 postgres:16-alpine
cd spikes/pgboss-enqueue && npm install && npm test
```
