// tests/inbox_topup.test.mjs — the `НОВОЕ` top-up (phase 6.4, plans/08).
//
// The owner's decisions this guards (idea 01, answered 2026-07-28): the inbox lives INSIDE the
// library root, it is called `НОВОЕ`, and an emptied inbox folder is deleted.
//
// What these specs are really about. The top-up is NOT a second pipeline — the inbox is part of the
// tree a normal run walks and the sort is already idempotent, so `apply` files it by itself. The
// phase is four places where that folder would misbehave, and the acceptance criteria in
// `plans/08` §5 are written against those places rather than against a new feature. Every guard
// below was verified by breaking the code first; where a guard turned out NOT to be independently
// falsifiable that is said out loud instead of implied (EXP-0008).
//
// The keeper spec (criterion 2) deserves its own note, because `plans/08` predicted it wrong. It
// measured the duplicate case with an UNDATED file and found the library copy winning on the date
// criterion, and concluded the new criterion was mere tie-breaking. Measured again with a file that
// carries its OWN capture date, the date criteria tie and DEPTH decides — `НОВОЕ/x.jpg` is one
// level deep, `2014/Весна/x.jpg` is two — so the freshly-dropped copy won and the settled file was
// planned out of the library into `ПРОЧЕЕ/_дубликаты/`. That is why the fixture here uses dated
// files: on an undated pair this spec would pass no matter what we had written.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { makeJpeg } from './fixtures/make.mjs';
import { applyArchive, planArchive, rollbackArchive, APPLY_OUTCOME } from '../src/app/phases.mjs';
import { inboxState, createInbox } from '../src/core/inbox.mjs';
import { INBOX_DIR, RUNS_DIR_NAME } from '../src/core/paths.mjs';

/** Phases are composed with the cache and the pixel search off: neither is what these specs test. */
const PLAIN = { cache: false, pixels: false };

const exists = async (p) => { try { await stat(p); return true; } catch { return false; } };

/**
 * A small tree that becomes a clean two-year library after one sort. Deliberately not the big
 * fixture: these specs are about what the INBOX does to a finished library, and a minimal library
 * makes every assertion below readable as a sentence.
 */
async function libraryWithTwoYears() {
  const root = await mkdtemp(join(tmpdir(), 'kpot-inbox-'));
  await writeFile(join(root, 'весна.jpg'), makeJpeg('2014:04:10 12:00:00', 701));
  await writeFile(join(root, 'лето.jpg'), makeJpeg('2019:07:01 08:30:00', 702));
  const applied = await applyArchive(root, PLAIN);
  assert.equal(applied.outcome, APPLY_OUTCOME.APPLIED);
  assert.equal(await exists(join(root, '2014', 'Весна', 'весна.jpg')), true, 'library not built');
  assert.equal(await exists(join(root, '2019', 'Лето', 'лето.jpg')), true, 'library not built');
  return root;
}

/**
 * Fill the inbox the way the owner would: material of two new years, one of it inside a subfolder
 * he named himself, and — the case that matters — a byte-identical copy of a photograph the library
 * has already shelved, under the SAME name, so nothing but the new criterion can separate them.
 */
async function fillInbox(root) {
  await mkdir(join(root, INBOX_DIR, 'с телефона'), { recursive: true });
  await writeFile(join(root, INBOX_DIR, 'новое.jpg'), makeJpeg('2020:08:05 10:00:00', 703));
  await writeFile(join(root, INBOX_DIR, 'с телефона', 'ещё.jpg'), makeJpeg('2021:03:15 16:45:00', 704));
  await cp(join(root, '2014', 'Весна', 'весна.jpg'), join(root, INBOX_DIR, 'весна.jpg'));
}

/** Every file under root as `relative path → sha256` (KPOT's own bookkeeping excluded). */
async function census(root) {
  const out = new Map();
  const stack = [{ abs: root, rel: '' }];
  while (stack.length > 0) {
    const d = stack.pop();
    for (const e of await readdir(d.abs, { withFileTypes: true })) {
      if (e.name === RUNS_DIR_NAME) continue;
      const rel = d.rel === '' ? e.name : `${d.rel}/${e.name}`;
      if (e.isDirectory()) stack.push({ abs: join(d.abs, e.name), rel });
      else out.set(rel, createHash('sha256').update(await readFile(join(d.abs, e.name))).digest('hex'));
    }
  }
  return out;
}

// ─── criterion 1: a top-up ADDS, and disturbs nothing that is already filed ──────────────────────
test('A TOP-UP MOVES NOTHING THAT IS ALREADY SHELVED — the phase\'s first promise', async () => {
  const root = await libraryWithTwoYears();
  try {
    const before = await census(root);
    await fillInbox(root);

    const applied = await applyArchive(root, PLAIN);
    assert.equal(applied.outcome, APPLY_OUTCOME.APPLIED);
    assert.equal(applied.result.failed, 0, JSON.stringify(applied.result.errors));

    const after = await census(root);
    // Every path the library had before the top-up is still exactly where it was, holding the same
    // bytes. This is the assertion that goes red when the keeper criterion is removed: the shelved
    // `2014/Весна/весна.jpg` is then evicted into `ПРОЧЕЕ/_дубликаты/`.
    for (const [path, sha] of before) {
      assert.equal(after.get(path), sha, `«${path}» was disturbed by a top-up`);
    }
    // …and the new material really did arrive, or the spec above would pass on an empty run.
    assert.equal(await exists(join(root, '2020', 'Лето', 'новое.jpg')), true);
    assert.equal(await exists(join(root, '2021', 'Весна', 'с телефона', 'ещё.jpg')), true);
  } finally { await rm(root, { recursive: true, force: true }); }
});

// ─── criterion 2: the copy in the inbox never evicts the copy in the library ─────────────────────
test('A DUPLICATE IN THE INBOX DOES NOT EVICT THE LIBRARY COPY — on a real tie of evidence', async () => {
  const root = await libraryWithTwoYears();
  try {
    await fillInbox(root);
    const { plan } = await planArchive(root, PLAIN);

    const group = plan.duplicates.find((g) => g.copies.some((c) => c.startsWith(`${INBOX_DIR}/`))
      || g.keeper.startsWith(`${INBOX_DIR}/`));
    assert.ok(group, 'the fixture must actually produce a duplicate group across the inbox');

    // The tie has to be REAL, or this spec proves nothing about the criterion under test: if the
    // date criteria separated the two copies, it would stay green with the criterion deleted. The
    // two copies here are the same bytes under the same name, both carrying the same EXIF capture
    // date — so status, assumed-ness and copy-marker all tie, and only depth is left.
    assert.equal(group.keeper, '2014/Весна/весна.jpg',
      'the copy already standing in the library must be the one that stays');
    assert.deepEqual(group.copies, [`${INBOX_DIR}/весна.jpg`]);
    assert.match(group.keeperReason, /уже разложен в библиотеке/,
      'the plan must tell the owner WHY this copy was kept, in his own language');

    // And the consequence the owner sees: the inbox copy is the one that goes to the quarantine.
    const move = plan.operations.find((o) => o.from === `${INBOX_DIR}/весна.jpg`);
    assert.ok(move, 'the inbox copy must be planned somewhere');
    assert.match(move.to, /^ПРОЧЕЕ\/_дубликаты\//);
    assert.equal(plan.operations.some((o) => o.from === '2014/Весна/весна.jpg'), false,
      'the shelved photograph must not be planned to move at all');
  } finally { await rm(root, { recursive: true, force: true }); }
});

// ─── criterion 3: the inbox is TRANSIT, so it is never rebuilt inside a season ───────────────────
test('a file from the inbox lands in <год>/<сезон>/, never in <год>/<сезон>/НОВОЕ/', async () => {
  const root = await libraryWithTwoYears();
  try {
    await fillInbox(root);
    const { plan } = await planArchive(root, PLAIN);

    for (const op of plan.operations) {
      assert.equal(op.to.split('/').includes(INBOX_DIR), false,
        `«${op.to}» rebuilds the inbox inside the library — it is transit, not a subject`);
    }
    const newOne = plan.operations.find((o) => o.from === `${INBOX_DIR}/новое.jpg`);
    assert.equal(newOne.to, '2020/Лето/новое.jpg');
    // The owner's OWN subfolder inside the inbox survives as nesting, exactly as it would anywhere
    // else in the tree — this rule drops the mailbox, not the names he chose.
    const nested = plan.operations.find((o) => o.from === `${INBOX_DIR}/с телефона/ещё.jpg`);
    assert.equal(nested.to, '2021/Весна/с телефона/ещё.jpg');
  } finally { await rm(root, { recursive: true, force: true }); }
});

// ─── criterion 4: the inbox is never put on the owner's approval table ───────────────────────────
// Today this holds for TWO independent reasons (a meaningful name is not suspicious, and a
// structural folder is skipped outright), so it is a behaviour-locking spec rather than a guard over
// one line: deleting either reason alone leaves it green. That is stated rather than implied.
test('the inbox is never proposed for the НА_РАЗБОР quarantine, however its files scatter', async () => {
  const root = await libraryWithTwoYears();
  try {
    await fillInbox(root);          // its files scatter over 2014, 2020 and 2021
    const { plan } = await planArchive(root, PLAIN);

    assert.equal(plan.suspicious.some((s) => s.dir === INBOX_DIR), false,
      'the owner must never be asked to approve his own mailbox');
    for (const op of plan.operations) {
      assert.equal(op.to.startsWith('НА_РАЗБОР/'), false, `«${op.to}» quarantines the inbox`);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

// ─── criterion 5: an emptied SUBfolder goes, the mailbox itself stays ────────────────────────────
test('THE INBOX SURVIVES ITS OWN EMPTYING, and its emptied subfolder does not', async () => {
  const root = await libraryWithTwoYears();
  try {
    await fillInbox(root);
    const { plan } = await planArchive(root, PLAIN);

    assert.equal(plan.emptied.includes(INBOX_DIR), false,
      'the owner\'s mailbox must not disappear after the first top-up');
    assert.equal(plan.emptied.includes(`${INBOX_DIR}/с телефона`), true,
      'an emptied inbox subfolder is deleted — the owner asked for exactly that');

    const applied = await applyArchive(root, PLAIN);
    assert.equal(applied.result.failed, 0, JSON.stringify(applied.result.errors));
    assert.equal(await exists(join(root, INBOX_DIR)), true, 'the inbox itself must still be there');
    assert.equal(await exists(join(root, INBOX_DIR, 'с телефона')), false,
      'the emptied subfolder should have been removed');
  } finally { await rm(root, { recursive: true, force: true }); }
});

// ─── criterion 6: a top-up is as undoable as any other run ───────────────────────────────────────
test('a full undo of a top-up restores the library AND the inbox, byte for byte', async () => {
  const root = await libraryWithTwoYears();
  try {
    await fillInbox(root);
    const before = await census(root);

    const applied = await applyArchive(root, PLAIN);
    assert.equal(applied.outcome, APPLY_OUTCOME.APPLIED);
    const rolled = await rollbackArchive(applied.result.runId, root);
    assert.equal(rolled.result.failed, 0, JSON.stringify(rolled.result.errors));

    const after = await census(root);
    assert.deepEqual([...after.entries()].sort(), [...before.entries()].sort(),
      'the tree after an undo must be indistinguishable from the tree before the top-up');
  } finally { await rm(root, { recursive: true, force: true }); }
});

// ─── criterion 7: a top-up does not break idempotence ────────────────────────────────────────────
test('a second run straight after a top-up has nothing to do', async () => {
  const root = await libraryWithTwoYears();
  try {
    await fillInbox(root);
    await applyArchive(root, PLAIN);

    const { plan } = await planArchive(root, PLAIN);
    assert.deepEqual(plan.operations, [],
      'a top-up that is not idempotent would nest the library one level deeper every run (bug 01)');
    // The false-deletion defect this phase also fixed (bug 05) shows up right here if it returns.
    assert.deepEqual(plan.emptied, [],
      'a settled library has no folder waiting to be deleted — bug 05');
  } finally { await rm(root, { recursive: true, force: true }); }
});

// ─── the inbox as an object the interface can look at and create ─────────────────────────────────
test('inboxState counts files at ANY depth, and tells «no folder» apart from «empty folder»', async () => {
  const root = await mkdtemp(join(tmpdir(), 'kpot-inboxstate-'));
  try {
    const absent = await inboxState(root);
    assert.deepEqual({ exists: absent.exists, files: absent.files }, { exists: false, files: 0 },
      'a missing inbox is a different state from an empty one, and the panel says so');

    await mkdir(join(root, INBOX_DIR, 'вложенная', 'глубже'), { recursive: true });
    const empty = await inboxState(root);
    assert.deepEqual({ exists: empty.exists, files: empty.files }, { exists: true, files: 0 });

    await writeFile(join(root, INBOX_DIR, 'a.jpg'), 'x');
    await writeFile(join(root, INBOX_DIR, 'вложенная', 'b.jpg'), 'y');
    await writeFile(join(root, INBOX_DIR, 'вложенная', 'глубже', 'c.jpg'), 'z');
    const full = await inboxState(root);
    assert.equal(full.files, 3, 'a phone dump arrives as folders — counting only the top level lies');
    assert.equal(full.name, INBOX_DIR);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('CREATING THE INBOX CANNOT INVENT ITS PARENT — a mistyped root leaves nothing behind', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'kpot-inboxmk-'));
  try {
    const missing = join(parent, 'папки-нет');
    await assert.rejects(() => createInbox(missing), /does not exist/);
    // The assertion that matters is the ABSENCE of an effect, not the wording of the error:
    // `mkdir` with `recursive` silently creates missing parents, which is exactly how planning a
    // mistyped path used to create that directory (phase 6.0).
    assert.equal(await exists(missing), false, 'a typo must not leave a folder on the owner\'s disk');

    // A file is not a root either.
    const notADir = join(parent, 'файл.txt');
    await writeFile(notADir, 'not a directory');
    await assert.rejects(() => createInbox(notADir), /not a directory/);
  } finally { await rm(parent, { recursive: true, force: true }); }
});

test('creating an inbox that already exists is a no-op, not an error', async () => {
  const root = await mkdtemp(join(tmpdir(), 'kpot-inboxtwice-'));
  try {
    const first = await createInbox(root);
    assert.equal(first.exists, true);
    await writeFile(join(root, INBOX_DIR, 'уже лежит.jpg'), 'kept');

    const second = await createInbox(root);
    assert.equal(second.exists, true);
    assert.equal(second.files, 1, 'a second click must not disturb what is already waiting inside');
  } finally { await rm(root, { recursive: true, force: true }); }
});
