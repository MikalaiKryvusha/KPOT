// tests/suspicious_dirs.test.mjs — folders KPOT will not sort until the owner has decided.
//
// Owner's instruction, 2026-07-26: «нужно подозрительные папки помечать, и выносить в инструменте
// на согласование владельца — сортировать их, или вносить в том виде, в каком они есть.» The owner
// also chose the criterion (an unclear NAME), the meaning of "as-is" (the folder stays exactly where
// it is) and the mechanism (an editable decisions file).
//
// The property that matters most here is the DEFAULT: an undecided folder is untouched. An approval
// step that proceeds without the answer is not an approval, so that is asserted first and hardest.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { inspectDirName, findSuspiciousDirs, heldBy } from '../src/plan/suspicious.mjs';
import { isTechnicalDir } from '../src/plan/bucket.mjs';
import { buildPlan, renderPlan } from '../src/plan/plan.mjs';
import {
  loadDecisions, saveDecisions, decisionsPathFor, DECISION_SORT, DECISION_AS_IS,
} from '../src/core/decisions.mjs';

/** A minimal dated photo asset, enough for the planner. Same date unless one is given. */
const photo = (path, date = '2016-04-04 00:00:00') => ({
  path, kind: 'photo', size: 10, mtimeMs: 0, sha256: path,
  verdict: { status: 'dated', date, winner: 'filename-timestamp' },
});

const scanOf = (...paths) => ({ root: '/x', assets: paths.map((p) => photo(p)), dirs: [] });

/**
 * A folder whose files would be SCATTERED by sorting — two different years.
 *
 * Since 2026-07-26 that is a precondition for asking the owner at all (his rule): a folder whose
 * files all land in one <год>/<сезон> arrives intact, name and grouping preserved as nesting, so
 * there is nothing to decide. Every "is it held?" spec therefore needs a folder that really would
 * be broken up — a single file can no longer be split by anything.
 */
const scattering = (dir) => ({
  root: '/x',
  dirs: [],
  assets: [photo(`${dir}/a.jpg`, '2016-04-04 00:00:00'), photo(`${dir}/b.jpg`, '2019-08-11 00:00:00')],
});

// ─── the criterion the owner chose ───────────────────────────────────────────────────────────────
// The owner's criterion, sharpened by him on 2026-07-26 after seeing the first real run:
// «осознанные названия — обычно это слова, фразы», and a name like `11` is «на отъебись» — there is
// nothing in it to protect, so it must be sorted without asking.
test('only a MEANINGFUL but unclear name is flagged; a careless name is just sorted', () => {
  // Placeholders — real words that name no content. «Разное» is one of the owner's own examples.
  for (const name of ['Разное', 'новая папка', 'New Folder', 'Без названия', 'tmp', 'misc']) {
    assert.equal(inspectDirName(name).suspicious, true, `«${name}» should be flagged`);
  }
  // Localized device/app folders: the English forms are already technical, these are the same
  // folders on a Russian system — the question the owner answers per archive.
  for (const name of ['скриншоты', 'Снимки экрана', 'Камера', 'Загрузки']) {
    assert.equal(inspectDirName(name).suspicious, true, `«${name}» should be flagged`);
  }

  // CARELESS names — no letters at all, or a bare hash. Nothing to protect: sort them silently.
  // `11` is the owner's own example, and the file inside it had a perfectly readable date.
  for (const name of ['11', '113', '123', '#1', '__', '---', '05.05.13', 'a1b2c3d4e5f6']) {
    assert.equal(inspectDirName(name).suspicious, false,
      `«${name}» says nothing — asking about it wastes the owner's attention`);
  }

  // Meaningful phrases must NOT be mistaken for identifiers. Both of these were wrongly flagged by
  // an "looks like an id" regex until the owner pointed out they are plainly phrases.
  for (const name of ['Ukraine_Fall_2020', 'Summer_2024_Belarus_Part_1']) {
    assert.equal(inspectDirName(name).suspicious, false, `«${name}» is a phrase, not an identifier`);
  }

  // …and the owner's ordinary folder names, which were never in question.
  for (const name of ['семейный архив', 'Мобилка', 'Из ВК', 'голосовые', 'свадьба Ани',
    'отпуск 2005', 'копии', 'старое', 'день рождения Кати']) {
    assert.equal(inspectDirName(name).suspicious, false, `«${name}» must NOT be flagged`);
  }
});

test('a folder is only raised when sorting would actually BREAK IT UP', () => {
  // All files land in one year/season: the folder arrives intact as nesting, name and grouping
  // preserved. Nothing to decide, so nothing is asked — and nothing is quarantined.
  const intact = buildPlan(scanOf('Разное/a.jpg', 'Разное/b.jpg'));
  assert.equal(intact.counts.awaitingDecision, 0, 'a folder that survives sorting raises no question');
  assert.deepEqual(intact.suspicious, []);
  assert.equal(intact.operations.every((o) => o.to.startsWith('2016/')), true,
    'it is simply sorted, keeping its own folder as nesting');
  assert.ok(intact.operations.some((o) => o.to === '2016/Весна/Разное/a.jpg'));

  // Different years: sorting WOULD scatter it, and that is the case worth the owner's attention.
  const split = buildPlan(scattering('Разное'));
  assert.equal(split.counts.awaitingDecision, 1);
  assert.equal(split.suspicious[0].dir, 'Разное');
});

test('only folders that actually hold media are raised, and a nested one is raised once', () => {
  const scan = scanOf('Разное/a.jpg', 'Разное/вложенное/b.jpg', 'Мобилка/c.jpg', 'tmp/d.jpg');
  const found = findSuspiciousDirs(scan.assets, isTechnicalDir);
  assert.deepEqual(found.map((f) => f.dir), ['tmp', 'Разное'].sort());
  assert.equal(found.find((f) => f.dir === 'Разное').files, 2, 'both files count toward the outer folder');
  // Deciding the parent decides the children — asking twice about one pile is the rejected noise.
  assert.equal(found.some((f) => f.dir === 'Разное/вложенное'), false);
});

// ─── the quarantine: undecided folders are set aside WHOLE, never taken apart ────────────────────
// Owner's revision, 2026-07-26: instead of being left in place, a folder under question is moved
// into `НА_РАЗБОР/` keeping its original parent structure, so everything needing a decision sits in
// one browsable place. "как есть" then means it simply stays there.
test('an undecided folder is set aside whole, with its original parent structure', () => {
  const plan = buildPlan({
    root: '/x', dirs: [],
    assets: [photo('Фото/архив/Разное/a.jpg', '2016-04-04 00:00:00'),
      photo('Фото/архив/Разное/b.jpg', '2019-08-11 00:00:00'),
      photo('Мобилка/c.jpg')],
  });
  assert.equal(plan.counts.awaitingDecision, 1);

  const held = plan.operations.find((o) => o.from === 'Фото/архив/Разное/a.jpg');
  assert.ok(held, 'the file must appear in the plan, not vanish from it');
  assert.equal(held.to, 'НА_РАЗБОР/Фото/архив/Разное/a.jpg',
    'the folder keeps its original parent path inside the quarantine');
  assert.match(held.reason, /ждёт вашего решения/);
  assert.equal(held.review, 'Фото/архив/Разное', 'the plan records WHICH folder is under question');

  // Nothing inside it is sorted into the library…
  assert.equal(plan.operations.some((o) => o.from.startsWith('Фото/архив/Разное/') && /^\d{4}\//.test(o.to)), false);
  // …while everything else is sorted as usual.
  assert.ok(plan.operations.some((o) => o.from === 'Мобилка/c.jpg' && /^\d{4}\//.test(o.to)));
});

test('«сортировать» releases the folder into the library; «как есть» leaves it in the quarantine', () => {
  const scan = scattering('Разное');

  const sorted = buildPlan(scan, { decisions: new Map([['Разное', 'sort']]) });
  assert.equal(sorted.counts.awaitingDecision, 0);
  assert.equal(sorted.operations.find((o) => o.from === 'Разное/a.jpg').to, '2016/Весна/Разное/a.jpg',
    'an approved folder is sorted like any other, keeping its name as nesting');
  assert.equal(sorted.operations.find((o) => o.from === 'Разное/b.jpg').to, '2019/Лето/Разное/b.jpg',
    'and its files go to the years they belong to — this is the scattering the owner approved');

  const asIs = buildPlan(scan, { decisions: new Map([['Разное', 'as-is']]) });
  assert.equal(asIs.operations[0].to, 'НА_РАЗБОР/Разное/a.jpg', '"as-is" means it stays in the quarantine');
  assert.match(asIs.operations[0].reason, /оставлена как есть/);
  assert.equal(asIs.counts.awaitingDecision, 0, 'an answered folder no longer awaits anything');
});

// The property the owner's "preserve the original structure" idea buys: stripping one prefix
// recovers the original path exactly, so quarantining is invisible afterwards and repeatable.
test('a folder already in the quarantine is not re-quarantined — the second run is a no-op', () => {
  const plan = buildPlan({
    root: '/x', dirs: [],
    assets: [photo('НА_РАЗБОР/Фото/архив/Разное/a.jpg', '2016-04-04 00:00:00'),
      photo('НА_РАЗБОР/Фото/архив/Разное/b.jpg', '2019-08-11 00:00:00')],
  });
  assert.deepEqual(plan.operations, [], 'a file already where it belongs must plan no move');
  assert.equal(plan.counts.awaitingDecision, 1, 'but it is still listed as awaiting a decision');
  assert.equal(plan.suspicious[0].dir, 'Фото/архив/Разное',
    'the decisions file must key on the ORIGINAL path, so the answer survives the move');
});

test('approving a quarantined folder sorts it as if it had never moved — «НА_РАЗБОР» never leaks', () => {
  // «Отпуск» is one of the owner's own names, so it survives as nesting — which is exactly what
  // must be reconstructed from the ORIGINAL path rather than from where the file physically sits.
  const plan = buildPlan(scanOf('НА_РАЗБОР/Отпуск/Разное/a.jpg'),
    { decisions: new Map([['Отпуск/Разное', 'sort']]) });
  assert.equal(plan.operations[0].to, '2016/Весна/Отпуск/Разное/a.jpg',
    'the library path is built from the ORIGINAL location, not from the quarantine one');
  assert.equal(plan.operations[0].to.includes('НА_РАЗБОР'), false);
});

// `stripReviewPrefix` only removes a LEADING prefix, so a folder named НА_РАЗБОР sitting deeper in
// the tree reaches the bucket logic intact. Without the quarantine being registered as one of
// KPOT's own layout directories it would be recreated inside the library as if the owner had named
// a folder that — bug 01's exact class, caught here before it could ship.
test('a nested folder named НА_РАЗБОР is structure too, not an owner name', () => {
  const plan = buildPlan(scanOf('Отпуск/НА_РАЗБОР/a.jpg'));
  assert.deepEqual(plan.suspicious, [], 'this path is about the layout rule, not about suspicion');
  assert.equal(plan.operations[0].to, '2016/Весна/Отпуск/a.jpg',
    'KPOT must never rebuild its own quarantine folder inside the library');
});

test('the report puts the request for a decision where it will be read', () => {
  const plan = buildPlan(scattering('Разное'));
  const text = renderPlan(plan);
  assert.match(text, /ПАПКИ, ПО КОТОРЫМ НУЖНО ВАШЕ РЕШЕНИЕ/);
  assert.match(text, /НЕ РАЗБИРАЮТСЯ/);
  assert.match(text, /НА_РАЗБОР\/Разное\//, 'the owner must see where the folder is going');
  // It must come before the long list of moves, or nobody answers it.
  assert.ok(text.indexOf('НУЖНО ВАШЕ РЕШЕНИЕ') < text.indexOf('ЧТО КУДА ПЕРЕЕДЕТ'));
});

// ─── the decisions file ──────────────────────────────────────────────────────────────────────────
test('the decisions file explains itself and keeps answers across runs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'kpot-decisions-'));
  try {
    const suspicious = [
      { dir: 'Разное', reason: 'имя-заглушка', files: 4 },
      { dir: 'скриншоты', reason: 'системная папка', files: 2 },
    ];
    await saveDecisions(root, suspicious, new Map());
    const text = await readFile(decisionsPathFor(root), 'utf8');
    // Written for a non-technical reader: it says what to do, in their language.
    assert.match(text, /ПАПКИ, ПО КОТОРЫМ НУЖНО ВАШЕ РЕШЕНИЕ/);
    assert.ok(text.includes(DECISION_SORT) && text.includes(DECISION_AS_IS));
    assert.ok(text.includes('Разное') && text.includes('скриншоты'));
    assert.ok(text.includes('медиафайлов внутри: 4'));

    // The owner answers one of them, by hand, with sloppy spacing and a synonym.
    await writeFile(decisionsPathFor(root),
      text.replace(/^Разное\s*=.*$/m, 'Разное   =  КАК ЕСТЬ  ').replace(/^скриншоты\s*=.*$/m, 'скриншоты = да'),
      'utf8');
    const first = await loadDecisions(root);
    assert.equal(first.decisions.get('Разное'), 'as-is', 'case and spacing must not reject an answer');
    assert.equal(first.decisions.get('скриншоты'), 'sort', 'an obvious synonym is accepted');

    // A later run regenerates the file — and must not throw the answers away.
    await saveDecisions(root, [...suspicious, { dir: 'tmp', reason: 'имя-заглушка', files: 1 }], first.decisions);
    const second = await loadDecisions(root);
    assert.equal(second.decisions.get('Разное'), 'as-is', 'a re-run must never erase the owner\'s work');
    assert.equal(second.decisions.get('скриншоты'), 'sort');
    assert.equal(second.decisions.has('tmp'), false, 'a newly-found folder starts unanswered');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('an answer that cannot be understood is reported, never guessed', async () => {
  const root = await mkdtemp(join(tmpdir(), 'kpot-decisions-bad-'));
  try {
    await saveDecisions(root, [{ dir: 'Разное', reason: 'r', files: 1 }], new Map());
    await writeFile(decisionsPathFor(root),
      '# комментарий\nРазное = может быть\nбез знака равенства\nскриншоты = как есть\n', 'utf8');
    const { decisions, unreadable } = await loadDecisions(root);
    assert.equal(decisions.has('Разное'), false, '"может быть" must not be interpreted as an answer');
    assert.equal(decisions.get('скриншоты'), 'as-is', 'the readable lines still count');
    assert.equal(unreadable.length, 2, 'both the bad value and the malformed line are reported');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a missing decisions file means nothing is decided — not an error', async () => {
  const root = await mkdtemp(join(tmpdir(), 'kpot-decisions-none-'));
  try {
    const { decisions, unreadable } = await loadDecisions(root);
    assert.equal(decisions.size, 0);
    assert.deepEqual(unreadable, []);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('heldBy finds the folder a file is waiting behind, at any depth', () => {
  const held = new Map([['Разное', null]]);
  assert.equal(heldBy('Разное/вложенное/a.jpg', held), 'Разное');
  assert.equal(heldBy('Разное/a.jpg', held), 'Разное');
  assert.equal(heldBy('Мобилка/a.jpg', held), null);
});
