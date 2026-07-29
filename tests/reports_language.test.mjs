// tests/reports_language.test.mjs — the owner's language requirement, applied to the REPORTS.
//
// Phase 6.6 (`plans/03` §Фаза 6.6). The requirement is his, in capitals: «ОЧЕНЬ ЮЗЕР ФРЕНДЛИ…
// БЕЗ ЖАРГОНИЗМОВ И СЛЕНГА», and its acceptance names the words: «хеш», «EXIF», «dry-run»,
// «вердикт», «когорта».
//
// WHY THIS FILE EXISTS AT ALL — it is the structural half of the phase, and worth more than any
// wording it fixes. `tests/ui_page.test.mjs` has guarded that requirement since 6.2, but it scans
// `src/ui/i18n.mjs` and nothing else. The reports are the OTHER surface the owner reads — the
// pre-sort master plan is the document `GOAL.md` is built around — and they were never covered.
// Reading them in this phase found «ОТЧЁТ О СУХОМ ПРОГОНЕ», a «БЭКАП» heading, «Манифест»,
// «жёстких ссылок», a printed `sha256`, and `XMP DocumentID` in a sentence about a photograph.
// Every one of those was in shipped code, and a grep over the dictionary could never have seen it.
//
// The check is deliberately over the RENDERED text, not over the source: a banned word can arrive
// from a constant, from a detail string built three modules away, or from an evidence label, and
// only the finished report knows what the person will actually read.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { makeJpeg } from './fixtures/make.mjs';
import { planArchive, applyArchive, rollbackArchive, renderPlan, renderApplyReport,
  renderRollbackReport } from '../src/app/phases.mjs';

const execFileP = promisify(execFile);
const MAKE = fileURLToPath(new URL('./fixtures/make.mjs', import.meta.url));

/**
 * The banned list, and every entry is here because the owner named it or because reading found it
 * addressed to him. Russian stems are plain substrings ON PURPOSE — JavaScript's `\b` is defined
 * over `[A-Za-z0-9_]`, so a Cyrillic pattern using it can never match anything and the guard would
 * silently pass forever (EXP-0017, learned the hard way on this project's other jargon spec).
 */
const BANNED = [
  { re: /хеш/i, why: 'the owner named it' },
  { re: /sha-?256/i, why: 'the same word in Latin — it was printed in the duplicates section' },
  { re: /\bEXIF\b/i, why: 'the owner named it' },
  { re: /dry[- ]run/i, why: 'the owner named it' },
  { re: /сух(ой|ом|ого) прогон/i, why: 'a literal rendering of "dry run"; the interface says «репетиция»' },
  { re: /вердикт/i, why: 'the owner named it' },
  { re: /когорт/i, why: 'the owner named it' },
  { re: /бэкап/i, why: 'we say «запасная копия» everywhere else' },
  { re: /манифест/i, why: 'a word for a file format, not for a person' },
  { re: /жёстк(ая|ие|их) ссылк/i, why: 'a filesystem term; the person needs the property, not the mechanism' },
  { re: /DocumentID|DerivedFrom/i, why: 'the name of a metadata field, in Latin, in a Russian sentence' },
  { re: /\bXMP\b/i, why: 'same' },
  { re: /\bmvhd\b|\bftyp\b/i, why: 'container internals' },
  { re: /\bJSON\b/i, why: 'a machine format the person never opens' },
];

/**
 * A line with the owner's own FILE NAMES taken out, because those are not ours to police.
 *
 * `GOAL.md` requires his names to survive the sort, so the reports print them verbatim — and one of
 * the fixture's real files is `сканы/скан_без_даты.jpg.xmp`, which this guard convicted of saying
 * «XMP» at him. That is the mirror of EXP-0017: a negative guard has to be narrow enough to fire
 * AND precise enough not to convict the innocent, and the first version of this one failed the
 * second half. The trade is stated rather than hidden: a banned word standing immediately inside a
 * path-like token is not caught. Anything in a SENTENCE still is, which is where jargon actually
 * hurts — nobody is confused by their own file's name.
 */
const prose = (line) => line
  .replace(/\S*[/\\]\S*/g, ' ')            // anything containing a path separator
  .replace(/\S+\.[a-z0-9]{2,5}\b/gi, ' '); // …and a bare `name.ext`

/** Assert one rendered surface carries none of them, and say WHICH line if it does. */
function assertPlainLanguage(label, text) {
  for (const { re, why } of BANNED) {
    const line = text.split('\n').find((l) => re.test(prose(l)));
    assert.equal(line, undefined,
      `${label} says «${String(re)}» to the owner (${why}):\n    ${line}`);
  }
}

async function messyTree() {
  const root = await mkdtemp(join(tmpdir(), 'kpot-lang-'));
  await execFileP(process.execPath, [MAKE, root]);
  await mkdir(join(root, 'НОВОЕ'), { recursive: true });
  await writeFile(join(root, 'НОВОЕ', 'новое.jpg'), makeJpeg('2024:05:18 14:00:00', 77));
  return root;
}

test('THE PRE-SORT MASTER PLAN speaks the owner\'s language', async () => {
  const root = await messyTree();
  try {
    const { plan } = await planArchive(root, { cache: false });
    const text = renderPlan(plan);
    // The fixture must actually exercise the interesting sections, or this proves very little.
    assert.ok(plan.duplicates.length > 0, 'the fixture must produce a duplicate group');
    assert.ok(plan.inherited.length > 0, 'and a date inherited from an original');
    assert.ok(plan.disputed.length > 0, 'and some disputed cases');
    assertPlainLanguage('the plan report', text);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('THE REPORTS AFTER A RUN speak it too — rehearsal, real run and undo', async () => {
  const root = await messyTree();
  try {
    const dry = await applyArchive(root, { cache: false, dryRun: true });
    assertPlainLanguage('the rehearsal report', renderApplyReport(dry.result, dry.root));

    const applied = await applyArchive(root, { cache: false });
    assert.ok(applied.result.moved > 0, 'the run must actually move something');
    assertPlainLanguage('the post-sort report', renderApplyReport(applied.result, applied.root));

    const rolled = await rollbackArchive(applied.result.runId, root);
    assertPlainLanguage('the undo report', renderRollbackReport(rolled.result));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('every count in the plan agrees with its noun — «1 групп» is not Russian', async () => {
  const root = await messyTree();
  try {
    const text = renderPlan((await planArchive(root, { cache: false })).plan);
    // The three forms Russian actually has. A number followed by the wrong one is the defect this
    // catches, and it is invisible to a banned-word list: «Дубликаты: 1 групп» contains no jargon.
    //
    // NO `\b` ANYWHERE NEAR THE CYRILLIC. JavaScript's word boundary is defined over [A-Za-z0-9_],
    // so `\b` after «папок» can never match and the whole pattern silently becomes decoration. The
    // first version of this very spec did exactly that and stayed GREEN with «1 папок» planted back
    // in — EXP-0017, walked into while writing the guard that cites it. The right end-anchor for a
    // Cyrillic word is a Unicode letter lookahead.
    const wrong = [
      /(?<!\d)1 (файлов|файла|папок|папки|случаев|случая|штук|штуки|группах)(?!\p{L})/u,
      /(?<!\d)[234] (файлов|папок|случаев|штук|группах)(?!\p{L})/u,
      /(?<!\d)(?:[5-9]|1[0-9]) (файла|файл|папка|папки|случай|случая|штука|штуки|группе)(?!\p{L})/u,
    ];
    for (const re of wrong) {
      const line = text.split('\n').find((l) => re.test(l));
      assert.equal(line, undefined, `a number does not agree with its noun:\n    ${line}`);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
