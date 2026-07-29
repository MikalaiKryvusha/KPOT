// tests/receipt.test.mjs — KPOT's receipt: the document it leaves saying what it did to a folder.
//
// The owner's rule, 2026-07-29, verbatim: «KPOT должен оставлять документ-расписку. Его нет —
// считаем, что беспорядок. Он есть — видим в нём историю сортировок.» It closes `bugs/06`, where
// the interface deduced its own past from the scenery — any directory named like a year meant
// "already sorted" — and so announced «Всё уже разложено» over an untouched heap.
//
// WHY THIS FILE EXISTS SEPARATELY, recorded because it is the honest reason: `src/core/receipt.mjs`
// and `libraryShape()` shipped carrying a `[TESTED: … tests/receipt.test.mjs]` marker while no such
// file existed. Checked on 2026-07-29 rather than assumed, the coverage was PARTLY real:
//
//   · that a real sort writes the receipt IS guarded, by `tests/ui_undo.test.mjs:238` — remove the
//     `recordSort` call and «after a sort the panel sees a library» goes red;
//   · that an undo removes it IS guarded, by that same spec's byte-for-byte census at :250, and
//     only because that census does NOT skip the receipt. **Do not "tidy" it to skip
//     `RECEIPT_NAME`** the way `apply_phase4` and `inbox_topup` legitimately do: it is the sole
//     guard on the rollback half, and skipping the file there deletes it silently;
//   · everything below was NOT guarded by anything, including the module's own headline claims.
//
// So these specs cover what the marker promised and nothing had: the rehearsal that must leave no
// trace, the parser that must key on a run id rather than on prose, and the tool's refusal to list
// its own paperwork among the owner's photographs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { makeJpeg } from './fixtures/make.mjs';
import { applyArchive, APPLY_OUTCOME } from '../src/app/phases.mjs';
import { scanTree } from '../src/scan/scan.mjs';
import { readReceipt, recordSort, forgetSort, RECEIPT_NAME } from '../src/core/receipt.mjs';

/** The cache and the pixel search are irrelevant here and only cost seconds. */
const PLAIN = { cache: false, pixels: false };

const exists = async (p) => { try { await stat(p); return true; } catch { return false; } };

/** A heap of two datable photographs — one sort turns it into a two-year library. */
async function heap(tag) {
  const root = await mkdtemp(join(tmpdir(), `kpot-rcpt-${tag}-`));
  await writeFile(join(root, 'весна.jpg'), makeJpeg('2014:04:10 12:00:00', 801));
  await writeFile(join(root, 'лето.jpg'), makeJpeg('2019:07:01 08:30:00', 802));
  return root;
}

// ─── the document itself ─────────────────────────────────────────────────────────────────────────

// The module's headline design claim, and the one with the most to lose: phase 6.6 spent a day
// rewriting owner-facing prose, and the NEXT such pass must not be able to break the program's
// memory of its own runs. So the parser is keyed on the run id, and this spec proves it by doing
// to the document exactly what a language pass would do — replacing every human sentence in it.
test('IT IS PARSED BY RUN ID, NEVER BY WORDING — a language pass must not erase KPOT\'s memory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'kpot-rcpt-prose-'));
  try {
    await recordSort(root, { runId: 'run-20260729-120000-aaa111', moved: 5 });
    await recordSort(root, { runId: 'run-20260729-130000-bbb222', moved: 7 });

    const path = join(root, RECEIPT_NAME);
    const rewritten = (await readFile(path, 'utf8'))
      .split(/\r?\n/)
      // Every line a person reads is REPLACED, not decorated — that is what a language pass does.
      // Only the lines carrying a run id survive, because those are the ones nobody rewrites.
      .map((l) => (/run-\d{8}-\d{6}-[0-9a-f]+/.test(l) || l.trim() === '' ? l : 'СОВСЕМ ДРУГИЕ СЛОВА'))
      .join('\n');
    await writeFile(path, rewritten, 'utf8');

    const after = await readReceipt(root);
    assert.equal(after.exists, true, 'the document still records that sorts happened here');
    assert.deepEqual(after.entries.map((e) => e.runId),
      ['run-20260729-130000-bbb222', 'run-20260729-120000-aaa111'],
      'both runs survive a total rewrite of the prose around them');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the newest sort is first, and recording one twice never duplicates it', async () => {
  const root = await mkdtemp(join(tmpdir(), 'kpot-rcpt-order-'));
  try {
    await recordSort(root, { runId: 'run-20260729-120000-aaa111', moved: 5 });
    await recordSort(root, { runId: 'run-20260729-130000-bbb222', moved: 7 });
    // A resumed run reports itself again under the SAME id — it must update its line, not add one.
    await recordSort(root, { runId: 'run-20260729-120000-aaa111', moved: 9 });

    const { entries } = await readReceipt(root);
    assert.deepEqual(entries.map((e) => e.runId),
      ['run-20260729-120000-aaa111', 'run-20260729-130000-bbb222'],
      'the one just recorded is first, and appears exactly once');
    assert.equal(entries.length, 2);
    assert.equal(entries[0].moved, 9, 'the re-recorded run carries its new count, not its old one');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('forgetting a run the document never had is silent — an undo may be repeated', async () => {
  const root = await mkdtemp(join(tmpdir(), 'kpot-rcpt-forget-'));
  try {
    await recordSort(root, { runId: 'run-20260729-120000-aaa111', moved: 5 });
    const before = await readFile(join(root, RECEIPT_NAME), 'utf8');

    await forgetSort(root, 'run-19990101-000000-nothere');
    assert.equal(await readFile(join(root, RECEIPT_NAME), 'utf8'), before,
      'a stranger\'s run id must not disturb a byte of it');

    // Rollback is idempotent by design; forgetting the same run twice must not become an error.
    await forgetSort(root, 'run-20260729-120000-aaa111');
    await forgetSort(root, 'run-20260729-120000-aaa111');
    assert.equal(await exists(join(root, RECEIPT_NAME)), false,
      'the last sort in effect was undone, so the document itself goes — the folder is a heap again');
  } finally { await rm(root, { recursive: true, force: true }); }
});

// The fail-safe direction, and the one the design leans on: no document, no claim. A person is told
// in the file's own text that deleting it is allowed, so "deleted by hand" is a supported state and
// must land on the wizard rather than on a panel making claims it can no longer support.
test('a damaged, empty or hand-deleted document all read as «no receipt» — the safe direction', async () => {
  const root = await mkdtemp(join(tmpdir(), 'kpot-rcpt-damaged-'));
  try {
    assert.equal((await readReceipt(root)).exists, false, 'no file at all');

    await writeFile(join(root, RECEIPT_NAME), '', 'utf8');
    assert.equal((await readReceipt(root)).exists, false, 'an empty file claims nothing');

    await writeFile(join(root, RECEIPT_NAME), 'что-то совсем другое\nбез единого запуска\n', 'utf8');
    const damaged = await readReceipt(root);
    assert.equal(damaged.exists, false, 'a document with no run id in it proves no run happened');
    assert.deepEqual(damaged.entries, []);
  } finally { await rm(root, { recursive: true, force: true }); }
});

// Owner-facing, and load-bearing rather than decorative: the whole fail-safe design above is only
// honest if the document actually tells the person that removing it is allowed and harmless.
test('the document says, in his own language, what it is and that deleting it is safe', async () => {
  const root = await mkdtemp(join(tmpdir(), 'kpot-rcpt-words-'));
  try {
    await recordSort(root, { runId: 'run-20260729-120000-aaa111', moved: 5 });
    const text = await readFile(join(root, RECEIPT_NAME), 'utf8');
    assert.ok(text.includes('можно спокойно удалить'),
      'the person must be told the file is safe to delete — the fail-safe path depends on it');
    assert.ok(/ни одна ваша фотография/.test(text), 'and told what it does NOT cost him');
    assert.ok(text.includes('разложено файлов: 5'), 'and what was actually done, in a countable form');
  } finally { await rm(root, { recursive: true, force: true }); }
});

// ─── the wiring: what a real run does ────────────────────────────────────────────────────────────

// `apply.mjs` restricts the write to `!dryRun && moved > 0`, and nothing guarded either half. A
// rehearsal that left a receipt would be the worst possible version of bug 06: the program would
// claim a sort that provably never happened, having promised the run changed nothing.
test('A REHEARSAL LEAVES NO RECEIPT — it did not sort anything, and must not say it did', async () => {
  const root = await heap('dry');
  try {
    const applied = await applyArchive(root, { ...PLAIN, dryRun: true });
    assert.equal(applied.outcome, APPLY_OUTCOME.APPLIED);
    assert.ok(applied.result.moved > 0, 'the rehearsal did simulate moves, or this proves nothing');

    assert.equal(await exists(join(root, RECEIPT_NAME)), false,
      'a rehearsal writes no receipt — nothing was moved');
    assert.equal((await readReceipt(root)).exists, false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a real sort writes it — and a second sort, which moves nothing, adds no second line', async () => {
  const root = await heap('real');
  try {
    const first = await applyArchive(root, PLAIN);
    assert.equal(first.outcome, APPLY_OUTCOME.APPLIED);
    assert.ok(first.result.moved > 0);

    const after = await readReceipt(root);
    assert.equal(after.exists, true, 'the sort is written down, which is what makes this a library');
    assert.deepEqual(after.entries.map((e) => e.runId), [first.result.runId],
      'the run recorded is the run that happened');
    assert.equal(after.entries[0].moved, first.result.moved, 'and it reports the true count');

    // Sorting an already-sorted library is a no-op (bug 01's promise). The receipt must be a no-op
    // too, or a person re-running the sort out of caution would grow a page of identical lines.
    const bytes = await readFile(join(root, RECEIPT_NAME), 'utf8');
    const second = await applyArchive(root, PLAIN);
    assert.equal(second.outcome, APPLY_OUTCOME.NOTHING_TO_MOVE, 'the library is already sorted');
    assert.equal(await readFile(join(root, RECEIPT_NAME), 'utf8'), bytes,
      'a run that moved nothing left the document exactly as it was');
  } finally { await rm(root, { recursive: true, force: true }); }
});

// `src/scan/scan.mjs` skips the receipt at the walk. Without that the tool would list its own
// paperwork under «остаётся на месте» in the master plan the owner reads — and, worse, treat it as
// one more unsorted file of his in every count on the page.
test('THE TOOL NEVER LISTS ITS OWN PAPERWORK among the owner\'s files', async () => {
  const root = await heap('scan');
  try {
    const applied = await applyArchive(root, PLAIN);
    assert.equal(applied.outcome, APPLY_OUTCOME.APPLIED);
    assert.equal(await exists(join(root, RECEIPT_NAME)), true, 'the receipt is really there on disk');

    const rescan = await scanTree(root);
    const seen = rescan.assets.filter((a) => a.path.includes(RECEIPT_NAME));
    assert.deepEqual(seen, [], 'the receipt leaked into the scan, and would reach the owner\'s plan');
  } finally { await rm(root, { recursive: true, force: true }); }
});
