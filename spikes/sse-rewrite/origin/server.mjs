// WP0 spike: a stand-in for the Render API. Streams SSE for DURATION_S seconds.
// Heartbeat comments keep idle proxies from closing the connection; progress events are the payload.
import http from 'node:http';

const port = Number(process.env.PORT ?? 8787);
const durationS = Number(process.env.DURATION_S ?? 90);
const tickMs = Number(process.env.TICK_MS ?? 1000);
const heartbeatMs = Number(process.env.HEARTBEAT_MS ?? 15000);

http
  .createServer((req, res) => {
    if (!req.url.startsWith('/jobs/') || !req.url.endsWith('/events')) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    });
    const started = Date.now();
    let seq = 0;
    const tick = setInterval(() => {
      seq += 1;
      res.write(`id: ${seq}\nevent: progress\ndata: ${JSON.stringify({ seq, t: Date.now() })}\n\n`);
    }, tickMs);
    const beat = setInterval(() => res.write(': ping\n\n'), heartbeatMs);
    const end = setTimeout(() => {
      res.write('event: done\ndata: {}\n\n');
      cleanup();
      res.end();
    }, durationS * 1000);
    function cleanup() {
      clearInterval(tick);
      clearInterval(beat);
      clearTimeout(end);
    }
    req.on('close', () => {
      cleanup();
      console.log(`client closed after ${Math.round((Date.now() - started) / 1000)}s`);
    });
  })
  .listen(port, () => console.log(`sse origin on :${port}, ${durationS}s streams`));
