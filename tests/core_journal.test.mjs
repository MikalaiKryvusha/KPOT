// tests/core_journal.test.mjs — specs for the append-only run journal.
// [TESTED: 2026-07-24 · runs green via npm test — suite 40/40]
// Every spec works in its own OS temp dir (never the repo) and removes it afterwards.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, appendFile, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRunJournal, readRunJournal, newRunId, JOURNAL_VERSION } from '../src/core/journal.mjs';

/** Run `fn` with a fresh temp dir, always cleaning up. */
async function withTmp(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'kpot-journal-'));
  try { return await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

test('write → read round-trip: header, ordered seq, payloads intact', () => withTmp(async (dir) => {
  const startedAt = new Date('2026-07-24T10:00:00Z');
  const j = await createRunJournal(dir, { runId: 'run-test-0001', meta: { target: 'X:\\фото' }, now: startedAt });
  await j.append('planned-move', { from: 'a.jpg', to: '2014/Лето/a.jpg' });
  await j.append('moved', { from: 'a.jpg', to: '2014/Лето/a.jpg' });

  const { header, records, truncated } = await readRunJournal(j.path);
  assert.equal(truncated, false);
  assert.equal(header.journalVersion, JOURNAL_VERSION);
  assert.equal(header.runId, 'run-test-0001');
  assert.equal(header.startedAt, startedAt.toISOString());
  assert.equal(header.meta.target, 'X:\\фото');
  assert.deepEqual(records.map(r => [r.kind, r.seq]), [['planned-move', 1], ['moved', 2]]);
  assert.equal(records[1].to, '2014/Лето/a.jpg');
}));

test('a journal is never silently overwritten; bad record kinds are rejected', () => withTmp(async (dir) => {
  const j = await createRunJournal(dir, { runId: 'run-test-0002' });
  await assert.rejects(() => createRunJournal(dir, { runId: 'run-test-0002' }), /EEXIST/);
  await assert.rejects(() => j.append('header'), TypeError); // header is reserved for line 1
  await assert.rejects(() => j.append(''), TypeError);
}));

test('a torn final line (crash mid-append) is reported, not fatal', () => withTmp(async (dir) => {
  const j = await createRunJournal(dir, { runId: 'run-test-0003' });
  await j.append('moved', { from: 'a', to: 'b' });
  await appendFile(j.path, '{"kind":"moved","seq":2,"from":"c"', 'utf8'); // no closing brace, no \n
  const { records, truncated } = await readRunJournal(j.path);
  assert.equal(truncated, true);
  assert.deepEqual(records.map(r => r.seq), [1]); // intact records survive
}));

test('non-journal and mid-corrupt files fail loudly', () => withTmp(async (dir) => {
  const alien = join(dir, 'alien.jsonl');
  await writeFile(alien, 'hello\n', 'utf8');
  await assert.rejects(() => readRunJournal(alien)); // first line not JSON → corrupt record error

  const j = await createRunJournal(dir, { runId: 'run-test-0004' });
  await j.append('moved', {});
  await j.append('moved', {});
  const broken = (await readFile(j.path, 'utf8')).replace('"seq":1', '"seq":1 OOPS');
  await writeFile(j.path, broken, 'utf8');
  await assert.rejects(() => readRunJournal(j.path), /corrupt journal record at line 2/);
}));

test('newRunId is sortable, filesystem-safe, and deterministic in its time part', () => {
  const id = newRunId(new Date('2026-07-24T15:30:12Z'));
  assert.match(id, /^run-20260724-153012-[0-9a-f]{6}$/);
});
