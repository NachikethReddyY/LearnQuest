# SSE through a Vercel rewrite (WP0 spike)

Question: does an SSE stream survive `/api/*` → Render through a Vercel rewrite, long enough for an import job (≥ 90 s) with heartbeats?

Files
- `origin/server.mjs`: stand-in for the Render API. `DURATION_S`, `TICK_MS`, `HEARTBEAT_MS` set the shape.
- `probe.mjs`: client. Reports first byte, progress count, largest gap, and whether `done` arrived.
- `web/vercel.json`: rewrite. `ORIGIN_HOST_HERE` must be replaced with the public origin host before deploy.

Local check (done): origin on :8787 with a 20 s stream; probe got 19 progress events and `done`.

Not done: the Vercel leg. It needs a public origin (Render) and a Vercel preview deploy under the owner's account. Run:

```bash
cd spikes/sse-rewrite/origin && DURATION_S=120 HEARTBEAT_MS=15000 node server.mjs
node spikes/sse-rewrite/probe.mjs https://<preview>.vercel.app/api/jobs/1/events 200
```

Pass: `doneReceived: true`, no early close, `maxGapMs` below 15 000 at 120 s.
If it fails, the plan's fallback applies: polling for import progress (plan §11.3), or `app.`/`api.` subdomains (Q5).
