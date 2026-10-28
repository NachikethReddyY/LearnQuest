// WP0 spike: read an SSE URL and report whether it streamed end to end.
// Usage: node probe.mjs <url> [maxSeconds]
// Pass: 'done' arrives, no gap longer than the heartbeat, and no early close.
const url = process.argv[2];
const maxS = Number(process.argv[3] ?? 200);
const start = Date.now();
const gaps = [];
let last = start;
let firstByte = null;
let events = 0;
let done = false;

const ctrl = new AbortController();
const timer = setTimeout(() => ctrl.abort(), maxS * 1000);
try {
  const res = await fetch(url, { headers: { Accept: 'text/event-stream' }, signal: ctrl.signal });
  console.log('status', res.status, 'content-type', res.headers.get('content-type'));
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done: eof } = await reader.read();
    const now = Date.now();
    if (eof) break;
    if (firstByte === null) firstByte = now - start;
    gaps.push(now - last);
    last = now;
    buf += decoder.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      if (block.includes('event: progress')) events += 1;
      if (block.includes('event: done')) done = true;
    }
  }
} catch (err) {
  console.log('stream error after', Math.round((Date.now() - start) / 1000), 's:', err.name, err.message);
} finally {
  clearTimeout(timer);
}
const maxGap = Math.max(0, ...gaps);
console.log(JSON.stringify({ firstByteMs: firstByte, progressEvents: events, maxGapMs: maxGap, doneReceived: done, totalS: Math.round((Date.now() - start) / 1000) }));
process.exit(done ? 0 : 1);
