// WP0 spike: can pg-boss enqueue a job on the same connection and transaction as an app write?
// Pass: rollback leaves no row and no job; commit leaves both; the job is invisible until commit;
// a singletonKey makes a retried enqueue idempotent.
// Run: DATABASE_URL=postgres://... pnpm test   (direct connection, not a transaction pooler)
import assert from 'node:assert/strict';
import pg from 'pg';
import { PgBoss } from 'pg-boss';

const url = process.env.DATABASE_URL ?? 'postgres://postgres:spike@localhost:54329/spike';
const queue = 'spike-mastery';
const admin = new pg.Client({ connectionString: url });
await admin.connect();
await admin.query('DROP SCHEMA IF EXISTS pgboss CASCADE');
await admin.query('DROP TABLE IF EXISTS spike_attempts');
await admin.query('CREATE TABLE spike_attempts (id serial PRIMARY KEY, note text)');
await admin.end();

const boss = new PgBoss({ connectionString: url });
boss.on('error', (err) => console.error('boss error', err));
await boss.start();
// singletonKey only dedupes on 'short' or 'singleton' policy queues; 'standard' ignores it.
await boss.createQueue(queue, { policy: 'short' });

// pg-boss runs its INSERT through our adapter, so it joins our transaction.
const adapter = (client) => ({ executeSql: (text, values) => client.query(text, values) });

// Count jobs with a separate pool, so the count does not see our open transaction.
async function countJobs(where = '') {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  const { rows } = await c.query(`SELECT count(*)::int AS n FROM pgboss.job WHERE name = $1 ${where}`, [queue]);
  await c.end();
  return rows[0].n;
}

async function attemptAndEnqueue(client, note, opts = {}) {
  await client.query('INSERT INTO spike_attempts (note) VALUES ($1)', [note]);
  await boss.send(queue, { note }, { db: adapter(client), ...opts });
}

// 1. Rollback: neither the row nor the job survives.
{
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query('BEGIN');
  await attemptAndEnqueue(client, 'rolled-back');
  assert.equal(await countJobs(), 0, 'job must be invisible to other connections before commit');
  await client.query('ROLLBACK');
  await client.end();
  assert.equal(await countJobs(), 0, 'rollback must drop the job');
  console.log('ok 1: rollback leaves no job');
}

// 2. Commit: row and job both appear, and the job is only visible after commit.
{
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query('BEGIN');
  await attemptAndEnqueue(client, 'committed');
  await client.query('COMMIT');
  await client.end();
  assert.equal(await countJobs(), 1, 'commit must publish the job');
  console.log('ok 2: commit publishes the row and the job');
}

// 3. Idempotent retry: the same singletonKey inside a second transaction adds no job.
{
  const key = 'mastery:attempt-1';
  for (let i = 0; i < 2; i++) {
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    await client.query('BEGIN');
    await attemptAndEnqueue(client, `retry-${i}`, { singletonKey: key });
    await client.query('COMMIT');
    await client.end();
  }
  assert.equal(await countJobs(`AND singleton_key = '${key}'`), 1, 'singletonKey must dedupe');
  console.log('ok 3: singletonKey dedupes a retried enqueue');
}

// 4. The job reaches a worker only after commit.
{
  const received = new Promise((resolve) => boss.work(queue, async ([job]) => resolve(job.data)));
  const data = await Promise.race([received, new Promise((_, rej) => setTimeout(() => rej(new Error('no job')), 10000))]);
  assert.ok(data.note, 'worker received a job payload');
  console.log('ok 4: worker receives the committed job', data);
}

await boss.stop({ graceful: true, timeout: 5000 });
console.log('PASS: pg-boss transactional enqueue works on the app connection');
