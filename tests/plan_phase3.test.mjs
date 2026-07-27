// tests/plan_phase3.test.mjs — Phase 3 acceptance: duplicates + the SortPlan.
//
// MASTER_PLAN Phase 3 acceptance criterion, made executable:
//   "the pre-sort master plan on the fixture tree is complete and human-readable, and every planted
//    ambiguity appears in the disputed section."
//
// The fixture's `expected.json` is this project's parity inventory (AGENT_GUIDE → Recon artifacts):
// one row per planted case, and delivery is judged BY THE ROWS. These specs assert on the machine-
// readable SortPlan, never on eyeballing (TESTING_FRAMEWORK).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeFixtureTree } from './fixtures/make.mjs';
import { scanTree } from '../src/scan/scan.mjs';
import { annotateAssets } from '../src/meta/annotate.mjs';
import { groupDuplicates, chooseKeeper, looksLikeACopy } from '../src/dedupe/dedupe.mjs';
import { buildPlan, renderPlan } from '../src/plan/plan.mjs';
import { customDirs, isTechnicalDir, isDateStructureDir, planBucket } from '../src/plan/bucket.mjs';

/**
 * The owner's folder decisions this spec runs under.
 *
 * WHY THIS EXISTS (added 2026-07-26, with the "suspicious folders" feature): the owner asked for
 * ambiguously-named folders to be held for approval instead of sorted, and «Разное» is one of the
 * examples they picked the criterion by. Its files therefore no longer move until it is approved —
 * which is correct behaviour, and would otherwise silently gut this spec.
 *
 * This supplies the missing PRECONDITION; it does not weaken the assertion. What this file tests is
 * "given a file with this evidence, where does it land" — so it must run in the state where sorting
 * happens. The new behaviour (that the folder is held at all, and that its files stay untouched
 * until decided) is asserted in tests/suspicious_dirs.test.mjs, not quietly dropped here.
 */
const APPROVED_FOR_SORTING = new Map([['Разное', 'sort'], ['скриншоты', 'sort']]);

/** Build the fixture, scan+annotate it, and produce the plan — the whole pipeline, once. */
async function withPlan(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'kpot-plan-'));
  try {
    await makeFixtureTree(dir);
    const scan = await scanTree(dir);
    await annotateAssets(scan.root, scan.assets);
    const expected = JSON.parse(await readFile(join(dir, 'expected.json'), 'utf8'));
    const plan = buildPlan(scan, {
      now: new Date('2026-07-26T00:00:00Z'),
      decisions: APPROVED_FOR_SORTING,
    });
    return await fn({ plan, scan, expected, dir, decisions: APPROVED_FOR_SORTING });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Target path planned for a source path (null when the file stays put). */
const targetOf = (plan, from) => plan.operations.find((o) => o.from === from)?.to ?? null;

// ---------------------------------------------------------------- bucket rules (pure, no fixture)

test('technical directories are dropped, the owner\'s own names are preserved', () => {
  // device dumps + the DCF convention (researches/02 §Directory structure)
  for (const t of ['DCIM', '100MEDIA', '101APPLE', '100ANDRO', 'Camera', 'Screenshots', 'WhatsApp Images'])
    assert.equal(isTechnicalDir(t), true, `${t} should be technical`);
  // the owner's own words survive
  for (const c of ['семейный архив', 'Мобилка', 'Из ВК', 'старое', 'отпуск 2005'])
    assert.equal(isTechnicalDir(c), false, `${c} should be the owner's`);
  // our own layout subdir names must never nest inside themselves
  for (const c of ['видео', 'аудио', 'Видео'])
    assert.equal(isTechnicalDir(c), true, `${c} collides with our own subdir`);
});

test('a directory carrying ONLY date structure is not a custom name', () => {
  for (const s of ['2013', 'Лето 2013', 'осень 2013', 'Зима_2020', '2014'])
    assert.equal(isDateStructureDir(s), true, `${s} is structure, not a name`);
  for (const s of ['отпуск 2005', 'семейный архив', 'лето в деревне 2013'])
    assert.equal(isDateStructureDir(s), false, `${s} carries the owner's meaning`);
});

test('custom parent dirs are kept in order, technical ones removed', () => {
  assert.deepEqual(customDirs('семейный архив/2005/отпуск/x.jpg'), ['семейный архив', 'отпуск']);
  assert.deepEqual(customDirs('100MEDIA/IMAG0178.jpg'), []);
  assert.deepEqual(customDirs('2013/Лето 2013/DSC01529.JPG'), []);
});

test('an ambiguous «зима» directory never guesses a winter bucket', () => {
  const asset = { path: 'Зима 2020/x.jpg', kind: 'photo',
    verdict: { status: 'partial', year: 2020, season: 'зима', assumed: false } };
  const d = planBucket(asset);
  assert.deepEqual(d.segments, ['2020', 'прочее'], 'must fall back to the per-year bucket');
  assert.equal(d.disputed.some((x) => x.issue === 'ambiguous-season'), true, 'and say so out loud');
});

// ---------------------------------------------------------------- dedupe

test('copy-marked names are recognized across the conventions in the real archive', () => {
  for (const p of ['a/лучшая фотка (копия).jpg', 'b/photo (2).jpg', 'c/img - копия.jpg', 'd/x (copy).png'])
    assert.equal(looksLikeACopy(p), true, `${p} looks like a copy`);
  for (const p of ['a/DSC02000.JPG', 'b/IMG_20140121_184626+.jpg', 'c/2013 (лето).jpg'])
    assert.equal(looksLikeACopy(p), false, `${p} does not`);
});

test('keeper selection is a total order — enumeration order cannot change the winner', () => {
  const members = [
    { path: 'копии/лучшая фотка (копия).jpg', verdict: { status: 'dated' } },
    { path: 'копии/DSC02000.JPG', verdict: { status: 'dated' } },
    { path: '2014/DSC02000.JPG', verdict: { status: 'dated' } },
  ];
  const first = chooseKeeper(members).keeper.path;
  assert.equal(first, '2014/DSC02000.JPG');
  // every permutation must agree — this is the canonical-order rule, checked rather than hoped for
  for (const perm of [[2, 0, 1], [1, 2, 0], [2, 1, 0], [0, 2, 1]]) {
    assert.equal(chooseKeeper(perm.map((i) => members[i])).keeper.path, first);
  }
});

test('a better-dated copy outranks a shallower undated one', () => {
  const { keeper, reason } = chooseKeeper([
    { path: 'a.jpg', verdict: { status: 'unknown' } },
    { path: 'deep/nested/b.jpg', verdict: { status: 'dated' } },
  ]);
  assert.equal(keeper.path, 'deep/nested/b.jpg');
  assert.match(reason, /date evidence/);
});

// ---------------------------------------------------------------- the plan, against ground truth

test('Phase 3 acceptance: every planted case lands where the owner decided', async () => {
  await withPlan(({ plan, expected }) => {
    // The parity inventory: one assertion row per planted file.
    const rows = {
      'Мобилка/IMG_20140121_183801.jpg': '2014/Зима начало года/Мобилка/IMG_20140121_183801.jpg',
      'Мобилка/IMG_20140121_184626.jpg': '2014/Зима начало года/Мобилка/IMG_20140121_184626.jpg',
      'Мобилка/IMG_20140121_184626+.jpg': '2014/Зима начало года/Мобилка/IMG_20140121_184626+.jpg',
      '100MEDIA/IMAG0178.jpg': '2011/Весна/IMAG0178.jpg',
      '100MEDIA/IMAG0179.jpg': '2011/Весна/IMAG0179.jpg',
      '100MEDIA/IMAG0180.jpg': '2011/Весна/IMAG0180.jpg',
      // dir-cohort ASSUMED year → per-year «прочее», never a season (decision log 2026-07-24)
      '100MEDIA/IMAG0181.jpg': '2011/прочее/IMAG0181.jpg',
      // the owner's own year/season dirs are rebuilt canonically, not nested
      '2013/Лето 2013/DSC01529.JPG': '2013/Лето/DSC01529.JPG',
      '2013/осень 2013/день рождения.jpg': '2013/Осень/день рождения.jpg',
      'Разное/1374250121884.jpg': '2013/Лето/Разное/1374250121884.jpg',
      // undatable → the GLOBAL «прочее», with the owner's folder preserved
      'Из ВК/6V2qnCITQIE.jpg': 'ПРОЧЕЕ/Из ВК/6V2qnCITQIE.jpg',
      'старое/IMAG0001.jpg': 'ПРОЧЕЕ/старое/IMAG0001.jpg',
      'скриншоты/Screenshot_2017-05-27-19-34-56-006_com.android.chrome.png':
        '2017/Весна/скриншоты/Screenshot_2017-05-27-19-34-56-006_com.android.chrome.png',
      'Разное/IMG-20160404-WA0001.jpg': '2016/Весна/Разное/IMG-20160404-WA0001.jpg',
      'семейный архив/скан.без названия': '2008/Зима конец года/семейный архив/скан.без названия',
      // the duplicate keeper goes to the library; its copies are set aside with provenance
      '2014/DSC02000.JPG': '2014/Лето/DSC02000.JPG',
      'копии/DSC02000.JPG': 'ПРОЧЕЕ/_дубликаты/копии__DSC02000.JPG',
      'копии/лучшая фотка (копия).jpg': 'ПРОЧЕЕ/_дубликаты/копии__лучшая фотка (копия).jpg',
      // video and audio get their own subdir inside the season (owner, 2026-07-24)
      'видео/VID_20161210_100950.mp4': '2016/Зима конец года/видео/VID_20161210_100950.mp4',
      'видео/MOV0001.mp4': '2018/Лето/видео/MOV0001.mp4',
      'голосовые/AUD-20150910-WA0003.ogg': '2015/Осень/аудио/голосовые/AUD-20150910-WA0003.ogg',
      // plans/02: editor exports — never shelved by the editor's save date
      'фотки с телефона/SAM_1001.jpg': '2013/Лето/фотки с телефона/SAM_1001.jpg',
      'фотки с телефона/SAM_1002.jpg': '2013/Лето/фотки с телефона/SAM_1002.jpg',
      'фотки с телефона/SAM_1003.jpg': '2013/Лето/фотки с телефона/SAM_1003.jpg',
      // the Photoshop crop: NOT 2014 (its save year) — the camera family's assumed 2013, unseasoned
      'фотки с телефона/правка.jpg': '2013/прочее/фотки с телефона/правка.jpg',
      'обработанное/оригинал.jpg': '2012/Весна/обработанное/оригинал.jpg',
      // the export inherits its original's real 2012 date via the XMP identity chain — NOT 2015
      'обработанное/экспорт.jpg': '2012/Весна/обработанное/экспорт.jpg',
      // no family, no original → honest global «прочее», NOT the save year 2014
      'обработанное/безымянный.jpg': 'ПРОЧЕЕ/обработанное/безымянный.jpg',
      // junk is quarantined with its provenance in the name — never deleted (interview #001 Q4)
      '100MEDIA/Thumbs.db': 'ПРОЧЕЕ/_мусор/100MEDIA__Thumbs.db',
      'Мобилка/.nomedia': 'ПРОЧЕЕ/_мусор/Мобилка__.nomedia',
    };
    for (const [from, to] of Object.entries(rows)) {
      assert.equal(targetOf(plan, from), to, `${from} must land in ${to}`);
    }

    // Non-media files are never moved (interview #001 Q5)
    for (const p of ['доки/письмо.docx', 'доки/заметка.txt']) {
      assert.equal(targetOf(plan, p), null, `${p} must not be moved`);
      assert.equal(plan.stay.some((s) => s.path === p), true, `${p} must be reported as staying`);
    }

    // Every planted file is accounted for — moved or explicitly left alone. Nothing silently lost.
    const planted = expected.files.map((f) => f.path);
    for (const p of planted) {
      const accounted = targetOf(plan, p) !== null || plan.stay.some((s) => s.path === p);
      assert.equal(accounted, true, `${p} appears in neither operations nor stay`);
    }
  });
});

test('Phase 3 acceptance: every planted ambiguity appears in the disputed section', async () => {
  await withPlan(({ plan, expected }) => {
    const disputedPaths = new Set(plan.disputed.map((d) => d.path));
    // the fixture plants exactly two ambiguity classes, each flagged in expected.json
    const plantedAmbiguous = expected.files
      .filter((f) => f.expected.disputed === true || f.expected.assumed === true)
      .map((f) => f.path);
    assert.ok(plantedAmbiguous.length >= 2, 'the fixture must plant ambiguities to test');
    for (const p of plantedAmbiguous) {
      assert.equal(disputedPaths.has(p), true, `planted ambiguity ${p} is missing from disputed`);
    }
    // the broken-clock EXIF must be named as rejected evidence, not silently dropped
    const brokenClock = plan.disputed.find((d) => d.path === 'старое/IMAG0001.jpg');
    assert.equal(brokenClock.issue, 'implausible-year');
    // the assumed year must be visibly an assumption
    const assumed = plan.disputed.find((d) => d.path === '100MEDIA/IMAG0181.jpg');
    assert.equal(assumed.issue, 'assumed-year');
  });
});

test('plans/02 acceptance: every editor export without a capture date carries its family signs', async () => {
  await withPlan(({ plan }) => {
    // the file the whole plan 02 exists for: family signs name the camera, the fork and the ceiling
    const cropped = plan.disputed.find((d) =>
      d.path === 'фотки с телефона/правка.jpg' && d.issue === 'editor-export-no-capture-date');
    assert.ok(cropped, 'the Photoshop crop must carry a family line in the owner\'s report');
    assert.match(cropped.detail, /семейство GT-I9100/);
    assert.match(cropped.detail, /по геометрии кадра/);
    assert.match(cropped.detail, /снято не позже 2014-02/);
    // …and the file where honesty is the whole answer: no family, but the ceiling still shows
    const unknown = plan.disputed.find((d) =>
      d.path === 'обработанное/безымянный.jpg' && d.issue === 'editor-export-no-capture-date');
    assert.ok(unknown, 'the undatable export must carry its line too');
    assert.match(unknown.detail, /камера-источник не определена/);
    assert.match(unknown.detail, /снято не позже 2014-11/);
    // the save date itself must be visibly rejected for BOTH (§1.1: it is a ceiling, not a date)
    for (const p of ['фотки с телефона/правка.jpg', 'обработанное/безымянный.jpg']) {
      assert.ok(plan.disputed.some((d) => d.path === p && d.issue === 'editor-save-date'),
        `${p}: the rejected save date must appear in disputed`);
    }
  });
});

test('the plan is deterministic — the same tree yields byte-identical actionable output', async () => {
  await withPlan(({ scan, decisions }) => {
    const a = buildPlan(scan, { now: new Date('2020-01-01T00:00:00Z'), decisions });
    const b = buildPlan(scan, { now: new Date('2031-12-31T23:59:59Z'), decisions });
    // Everything the executor acts on must be identical; only `meta` may carry the clock.
    for (const key of ['operations', 'duplicates', 'disputed', 'collisions', 'stay', 'counts']) {
      assert.deepEqual(a[key], b[key], `${key} must not depend on the clock`);
    }
    assert.notEqual(a.meta.plannedAt, b.meta.plannedAt, 'the timestamp is deliberately in meta');
    // and shuffling the scan's asset order must not change the plan either — same decisions, since
    // this checks independence from the filesystem's enumeration order, not from the owner's answers
    const shuffled = { ...scan, assets: [...scan.assets].reverse() };
    assert.deepEqual(
      buildPlan(shuffled, { now: new Date('2020-01-01T00:00:00Z'), decisions }).operations,
      a.operations,
    );
  });
});

/** A same-dated photo of arbitrary content — the raw material for the collision specs. */
const datedPhoto = (path, sha) => ({ path, kind: 'photo', size: sha.length, sha256: sha,
  verdict: { status: 'dated', date: '2014-08-10 12:00:00', winner: 'exif-original', disputed: [] } });

test('preserved custom dirs keep same-named files apart without any renaming', () => {
  // Two different photos, same date, same basename — but the owner's own folders separate them,
  // so nothing needs renaming. This is the name-preservation rule paying off (GOAL.md).
  const plan = buildPlan({ root: '/x', assets: [datedPhoto('a/IMG.jpg', 'aaa'), datedPhoto('b/IMG.jpg', 'bbb')] });
  const targets = plan.operations.map((o) => o.to).sort();
  assert.deepEqual(targets, ['2014/Лето/a/IMG.jpg', '2014/Лето/b/IMG.jpg']);
  assert.equal(plan.collisions.length, 0, 'no collision, so nothing to report');
});

test('a genuine name collision is resolved by suffixing, never by overwriting', () => {
  // Both land in the bare season dir (`DCIM` is technical and dropped): same target, different
  // content. Without collision handling, applying this plan would destroy one of the two photos.
  const plan = buildPlan({ root: '/x', assets: [datedPhoto('IMG.jpg', 'aaa'), datedPhoto('DCIM/IMG.jpg', 'bbb')] });
  const targets = plan.operations.map((o) => o.to).sort();
  assert.deepEqual(targets, ['2014/Лето/IMG (2).jpg', '2014/Лето/IMG.jpg']);
  assert.equal(new Set(targets).size, 2, 'no two operations may share a target');
  assert.equal(plan.collisions.length, 1, 'and the rename must be reported to the owner');
  assert.equal(plan.collisions[0].target, '2014/Лето/IMG.jpg');
  assert.equal(plan.collisions[0].resolved.length, 2, 'both claimants are listed, winner first');
  // the renamed file still carries the owner's original name, only extended
  assert.match(plan.operations.find((o) => o.collisionRenamed).to, /IMG \(2\)\.jpg$/);
});

test('three-way collisions keep counting up instead of colliding again', () => {
  const plan = buildPlan({ root: '/x', assets: [
    datedPhoto('IMG.jpg', 'aaa'), datedPhoto('DCIM/IMG.jpg', 'bbb'), datedPhoto('100MEDIA/IMG.jpg', 'ccc'),
  ] });
  const targets = plan.operations.map((o) => o.to).sort();
  assert.deepEqual(targets, ['2014/Лето/IMG (2).jpg', '2014/Лето/IMG (3).jpg', '2014/Лето/IMG.jpg']);
  assert.equal(new Set(targets).size, 3);
});

test('the human-readable plan states plainly that nothing has moved', async () => {
  await withPlan(({ plan }) => {
    const text = renderPlan(plan);
    assert.match(text, /ЭТО ТОЛЬКО ПЛАН\. Ни один файл ещё не тронут\./);
    assert.match(text, /ПРЕД-СОРТИРОВОЧНЫЙ МАСТЕР-ПЛАН/);
    assert.match(text, /ДУБЛИКАТЫ/);
    assert.match(text, /СПОРНЫЕ СЛУЧАИ/);
    // the owner must be able to read a destination and its source next to each other
    assert.match(text, /2014\/Лето\//);
    assert.match(text, /← 2014\/DSC02000\.JPG/);
  });
});

test('planning writes nothing — the tree is untouched afterwards', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kpot-plan-ro-'));
  try {
    await makeFixtureTree(dir);
    const before = await scanTree(dir);
    await annotateAssets(before.root, before.assets);
    buildPlan(before);
    const after = await scanTree(dir);
    assert.deepEqual(
      after.assets.map((a) => [a.path, a.size, a.sha256]),
      before.assets.map((a) => [a.path, a.size, a.sha256]),
      'RULE 1: the plan phase must not modify, move or create a single file',
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
