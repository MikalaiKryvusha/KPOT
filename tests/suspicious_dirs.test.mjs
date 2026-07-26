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

/** A minimal dated photo asset, enough for the planner. */
const photo = (path) => ({
  path, kind: 'photo', size: 10, mtimeMs: 0, sha256: path,
  verdict: { status: 'dated', date: '2016-04-04 00:00:00', winner: 'filename-timestamp' },
});

const scanOf = (...paths) => ({ root: '/x', assets: paths.map(photo), dirs: [] });

// ─── the criterion the owner chose ───────────────────────────────────────────────────────────────
test('an unclear name is flagged; a name that says something is not', () => {
  // Placeholder names — they name no content. «Разное» is one of the owner's own examples.
  for (const name of ['Разное', 'новая папка', 'New Folder', 'Без названия', 'tmp', 'misc']) {
    assert.equal(inspectDirName(name).suspicious, true, `«${name}» should be flagged`);
  }
  // Localized device/app folders: the English forms are already technical, these are the same
  // folders on a Russian system — the question the owner now answers per archive.
  for (const name of ['скриншоты', 'Снимки экрана', 'Камера', 'Загрузки']) {
    assert.equal(inspectDirName(name).suspicious, true, `«${name}» should be flagged`);
  }
  // Names carrying no letters, and technical-looking identifiers.
  for (const name of ['123', '#1', '__', 'a1b2c3d4e5f6', 'AbCdEfGh12345678']) {
    assert.equal(inspectDirName(name).suspicious, true, `«${name}» should be flagged`);
  }
  // The owner's real folder names must NOT be flagged — the owner rejected the broad criteria
  // precisely because an approval list full of noise stops being read.
  for (const name of ['семейный архив', 'Мобилка', 'Из ВК', 'голосовые', 'свадьба Ани',
    'отпуск 2005', 'копии', 'старое', 'день рождения Кати']) {
    assert.equal(inspectDirName(name).suspicious, false, `«${name}» must NOT be flagged`);
  }
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
  const plan = buildPlan(scanOf('Фото/архив/Разное/a.jpg', 'Мобилка/b.jpg'));
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
  assert.ok(plan.operations.some((o) => o.from === 'Мобилка/b.jpg' && /^\d{4}\//.test(o.to)));
});

test('«сортировать» releases the folder into the library; «как есть» leaves it in the quarantine', () => {
  const scan = scanOf('Разное/a.jpg');

  const sorted = buildPlan(scan, { decisions: new Map([['Разное', 'sort']]) });
  assert.equal(sorted.counts.awaitingDecision, 0);
  assert.equal(sorted.operations[0].to, '2016/Весна/Разное/a.jpg',
    'an approved folder is sorted like any other, keeping its name as nesting');

  const asIs = buildPlan(scan, { decisions: new Map([['Разное', 'as-is']]) });
  assert.equal(asIs.operations[0].to, 'НА_РАЗБОР/Разное/a.jpg', '"as-is" means it stays in the quarantine');
  assert.match(asIs.operations[0].reason, /оставлена как есть/);
  assert.equal(asIs.counts.awaitingDecision, 0, 'an answered folder no longer awaits anything');
});

// The property the owner's "preserve the original structure" idea buys: stripping one prefix
// recovers the original path exactly, so quarantining is invisible afterwards and repeatable.
test('a folder already in the quarantine is not re-quarantined — the second run is a no-op', () => {
  const plan = buildPlan(scanOf('НА_РАЗБОР/Фото/архив/Разное/a.jpg'));
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

test('the report puts the request for a decision where it will be read', () => {
  const plan = buildPlan(scanOf('Разное/a.jpg'));
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
