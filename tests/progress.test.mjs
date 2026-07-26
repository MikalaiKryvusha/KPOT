// tests/progress.test.mjs — the live progress line.
//
// Progress is a SAFETY feature here, not a courtesy: `researches/02` counts the real archive at
// 71 606 files / 551 GB, and a window that has said nothing for forty minutes is indistinguishable
// from a hang. The rational response to a hang is Ctrl-C — in the middle of a sort.
//
// But a progress reporter is also the classic way to break a CLI, so the specs below are weighted
// toward what it must NEVER do: never touch stdout (which carries the JSON artifacts), never change
// what a phase produces, and never emit anything at all when nobody is watching.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { createProgress, humanBytes, humanDuration } from '../src/core/progress.mjs';
import { scanTree } from '../src/scan/scan.mjs';

const execFileP = promisify(execFile);
const MAKE = fileURLToPath(new URL('./fixtures/make.mjs', import.meta.url));
const KPOT = fileURLToPath(new URL('../bin/kpot.mjs', import.meta.url));

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'kpot-progress-'));
  await execFileP(process.execPath, [MAKE, dir]);
  return dir;
}

/** A fake stream that records what was written, standing in for a terminal. */
function fakeTTY({ isTTY = true } = {}) {
  const chunks = [];
  return { isTTY, write: (s) => { chunks.push(s); return true; }, chunks, text: () => chunks.join('') };
}

// ─── what it must never do ───────────────────────────────────────────────────────────────────────
test('progress is silent when nobody is watching — a pipe or a log file gets nothing', () => {
  const notATerminal = fakeTTY({ isTTY: false });
  const p = createProgress({ stream: notATerminal });
  assert.equal(p.enabled, false);
  p.start('Читаю файлы', 100);
  for (let i = 0; i < 50; i++) p.tick(1024);
  p.done('готово');
  assert.deepEqual(notATerminal.chunks, [],
    'a carriage-return progress bar in a log file is unreadable noise — it must not be written at all');
});

test('a disabled reporter is still safe to call — callers never need an if', () => {
  const p = createProgress({ stream: fakeTTY({ isTTY: false }) });
  assert.doesNotThrow(() => { p.start('x', 1); p.tick(); p.tick(5); p.done('y'); });
});

test('the CLI keeps stdout clean: the artifact is the only thing on it', async () => {
  const root = await fixture();
  try {
    // stdout must be parseable as JSON with nothing prepended — the whole point of `kpot scan > map.json`.
    const scan = await execFileP(process.execPath, [KPOT, 'scan', root], { maxBuffer: 64 * 1024 * 1024 });
    const parsed = JSON.parse(scan.stdout);
    assert.ok(Array.isArray(parsed.assets) && parsed.assets.length > 0);

    const plan = await execFileP(process.execPath, [KPOT, 'plan', root, '--json'], { maxBuffer: 64 * 1024 * 1024 });
    assert.ok(Array.isArray(JSON.parse(plan.stdout).operations));

    // And no escape sequences anywhere on stdout, terminal or not.
    const ESC = String.fromCharCode(27);
    assert.equal(scan.stdout.includes(ESC), false, 'stdout must never carry terminal control codes');
    assert.equal(plan.stdout.includes(ESC), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a scan produces byte-identical output with and without a progress reporter', async () => {
  const root = await fixture();
  try {
    const withOut = await scanTree(root);
    const withIt = await scanTree(root, { progress: createProgress({ stream: fakeTTY() }) });
    // `scannedAt` is a clock and is expected to differ; everything the pipeline consumes must not.
    assert.deepEqual(withIt.assets, withOut.assets,
      'progress is called, never read — the scan result cannot depend on it');
    assert.deepEqual(withIt.dirs, withOut.dirs);
  } finally { await rm(root, { recursive: true, force: true }); }
});

// ─── what it must do ─────────────────────────────────────────────────────────────────────────────
test('a watched run reports progress that grows, and ends with a summary that stays', () => {
  const tty = fakeTTY();
  let clock = 0;
  const p = createProgress({ stream: tty, now: () => clock });

  p.start('Читаю файлы', 4);
  for (let i = 0; i < 4; i++) { clock += 1000; p.tick(1024 * 1024); }
  p.done('Прочитано 4 файла');

  const text = tty.text();
  assert.match(text, /Читаю файлы/);
  assert.match(text, /4\/4/, 'the last repaint must show the finished count');
  assert.match(text, /100%/);
  assert.match(text, /Прочитано 4 файла/, 'the summary survives on screen after the line is cleared');
  assert.ok(text.endsWith('\n'), 'the summary ends the line so the next output starts cleanly');
});

test('repainting is throttled — 71 606 ticks must not mean 71 606 writes', () => {
  const tty = fakeTTY();
  let clock = 0;
  const p = createProgress({ stream: tty, now: () => clock });
  p.start('Читаю файлы', 10_000);
  for (let i = 0; i < 10_000; i++) p.tick(1);   // no time passes: one burst
  assert.ok(tty.chunks.length < 20,
    `an unthrottled bar spends more time writing escape codes than the scan spends hashing (wrote ${tty.chunks.length})`);
});

test('an estimate appears only once there is enough evidence for one', () => {
  const tty = fakeTTY();
  let clock = 0;
  const p = createProgress({ stream: tty, now: () => clock });
  p.start('Читаю файлы', 100);

  clock += 500; p.tick();                       // too early to estimate anything honestly
  assert.equal(tty.text().includes('осталось'), false);

  for (let i = 0; i < 20; i++) { clock += 1000; p.tick(); }
  assert.match(tty.text(), /осталось ~/, 'once a rate has been observed, it is used — no model, no guess');
});

test('a phase with an unknown total still shows life', () => {
  const tty = fakeTTY();
  let clock = 0;
  const p = createProgress({ stream: tty, now: () => clock });
  p.start('Осматриваю папки');            // the walk cannot know its total until it has finished
  clock += 500; p.tick();
  const text = tty.text();
  assert.match(text, /Осматриваю папки/);
  assert.equal(text.includes('%'), false, 'a percentage with no denominator would be a lie');
});

// ─── the human-facing formatting ─────────────────────────────────────────────────────────────────
test('sizes and durations are written the way a person reads them', () => {
  assert.equal(humanBytes(0), '0 Б');
  assert.equal(humanBytes(1023), '1023 Б');
  assert.equal(humanBytes(1024), '1.0 КБ');
  assert.equal(humanBytes(551 * 1024 ** 3), '551 ГБ', 'the real archive, as the owner would see it');
  assert.equal(humanBytes(-1), '?');

  assert.equal(humanDuration(900), '1 с');
  assert.equal(humanDuration(90_000), '1 мин 30 с');
  assert.equal(humanDuration(3 * 3600_000 + 25 * 60_000), '3 ч 25 мин');
});
