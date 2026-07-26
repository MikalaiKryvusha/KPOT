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

// ─── the default: undecided means untouched ──────────────────────────────────────────────────────
test('an undecided folder is NOT sorted — its files stay exactly where they are', () => {
  const plan = buildPlan(scanOf('Разное/a.jpg', 'Мобилка/b.jpg'));
  assert.equal(plan.counts.awaitingDecision, 1);
  assert.equal(plan.operations.some((o) => o.from.startsWith('Разное/')), false,
    'a folder awaiting approval must not be sorted');
  const held = plan.stay.find((s) => s.path === 'Разное/a.jpg');
  assert.ok(held, 'the file must be reported as staying, not silently dropped from the plan');
  assert.match(held.reason, /ждёт вашего решения/);
  // …while everything else is sorted as usual.
  assert.ok(plan.operations.some((o) => o.from === 'Мобилка/b.jpg'));
});

test('«сортировать» releases the folder; «как есть» leaves it exactly where it is', () => {
  const scan = scanOf('Разное/a.jpg');

  const sorted = buildPlan(scan, { decisions: new Map([['Разное', 'sort']]) });
  assert.equal(sorted.counts.awaitingDecision, 0);
  assert.equal(sorted.operations[0].to, '2016/Весна/Разное/a.jpg',
    'an approved folder is sorted like any other, keeping its name as nesting');

  const asIs = buildPlan(scan, { decisions: new Map([['Разное', 'as-is']]) });
  assert.equal(asIs.operations.length, 0, '"as-is" means the folder is not moved at all');
  assert.match(asIs.stay[0].reason, /оставлена как есть/);
  assert.equal(asIs.counts.awaitingDecision, 0, 'an answered folder no longer awaits anything');
});

test('the report puts the request for a decision where it will be read', () => {
  const plan = buildPlan(scanOf('Разное/a.jpg'));
  const text = renderPlan(plan);
  assert.match(text, /ПАПКИ, ПО КОТОРЫМ НУЖНО ВАШЕ РЕШЕНИЕ/);
  assert.match(text, /KPOT их НЕ ТРОГАЕТ/);
  assert.ok(text.includes('Разное/'));
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
