// src/core/receipt.mjs — the document KPOT leaves behind saying what it did to this folder.
// [TESTED: 2026-07-29 · tests/receipt.test.mjs — written on a real sort, removed by an undo, the
// file deleted when the last entry goes, parsed by run id rather than by prose; break-verified]
//
// THE OWNER'S RULE, 2026-07-29, verbatim: «KPOT должен оставлять документ-расписку. Его нет —
// считаем, что беспорядок. Он есть — видим в нём историю сортировок.»
//
// It replaces a guess with a memory, and that is the whole point (`bugs/06`). Until now the
// interface decided which of its two faces to show by LOOKING at the folder: a directory named like
// a year meant "already sorted". A great many people — the owner among them, per
// `researches/02` — have a hand-made `2013/` sitting in an otherwise untouched heap, so the program
// announced «Всё уже разложено» over an archive where nothing had been done, and said «Пока ничего
// не запускалось» two blocks below on the same screen. A tool should not deduce its own past from
// the scenery when it can simply write it down.
//
// Three properties this file is built for, in order:
//
//   1. **A PERSON CAN READ IT.** It is not a marker file and not a database — it is a plain
//      document in his language, in the root of his own library, that answers "what did this
//      program do to my photographs?" without running anything.
//   2. **It lists the sorts that are STILL IN EFFECT.** An undone run is removed from it, and when
//      the last one goes the file goes too — so the answer to "is this a library?" stays true after
//      a rollback instead of describing a folder that no longer exists that way.
//   3. **It is parsed by RUN ID, never by wording.** `run-20260729-141204-22687e` is a machine
//      token; «разложено» is prose, and prose is exactly what phase 6.6 spent a day rewriting. A
//      parser keyed on sentences would break the next time somebody improves one.
//
// RULE 1 note: this writes ONE file of KPOT's own into the archive root. It never touches a
// photograph — the same standing as `.kpot-runs/`, which `src/core/` already writes.

import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * The document's name. Visible, in Russian, and boring on purpose: it has to be obvious what it is
 * when a person meets it among their own folders, and obvious that deleting it is allowed.
 */
export const RECEIPT_NAME = 'KPOT — что здесь сделано.txt';

/** A run id as it appears in the document — the one token we parse, and the one nobody rewrites. */
const RUN_ID_RE = /run-\d{8}-\d{6}-[0-9a-f]+/;

const HEADER = [
  'KPOT — ЧТО ЗДЕСЬ СДЕЛАНО',
  '='.repeat(60),
  '',
  'Это расписка программы KPOT о том, что она делала с этой папкой.',
  '',
  'Пока этот файл лежит здесь, KPOT считает папку уже разобранной и при запуске',
  'сразу открывает пульт управления. Если файла нет — KPOT считает, что здесь',
  'беспорядок, и предлагает разобрать всё по шагам с самого начала.',
  '',
  'Файл можно спокойно удалить: ни одна ваша фотография от этого не пострадает,',
  'программа просто предложит начать разбор заново.',
  '',
  'СОРТИРОВКИ, КОТОРЫЕ СЕЙЧАС В СИЛЕ',
  '-'.repeat(60),
  '',
];

/** Local wall clock, because the person reading this did the sort in their own time zone. */
function whenInWords(now) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(now.getDate())}.${p(now.getMonth() + 1)}.${now.getFullYear()}, `
    + `${p(now.getHours())}:${p(now.getMinutes())}`;
}

/** One entry, as the person reads it and as we parse it back. */
function renderEntry(e) {
  return [
    `${e.when} — разложено файлов: ${e.moved}`,
    `    если захотите вернуть всё как было:  kpot rollback ${e.runId}`,
    '',
  ].join('\n');
}

/**
 * Read the receipt. A missing, unreadable or empty document all answer the same way — «no receipt»
 * — because for the question this file exists to answer they mean the same thing.
 *
 * @param {string} root the archive root
 * @returns {Promise<{path: string, exists: boolean, entries: Array<{runId, when, moved, text}>}>}
 */
export async function readReceipt(root) {
  const path = join(root, RECEIPT_NAME);
  let raw;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    return { path, exists: false, entries: [] };
  }
  const entries = [];
  const lines = raw.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    // An entry is recognised by its run id, and its first line is the one a person reads.
    const idOnNext = lines[i + 1]?.match(RUN_ID_RE);
    if (!idOnNext) continue;
    const head = lines[i];
    const moved = Number((head.match(/(\d+)\s*$/) ?? [])[1] ?? 0);
    const when = (head.split(' — ')[0] ?? '').trim();
    entries.push({ runId: idOnNext[0], when, moved, text: head });
  }
  return { path, exists: entries.length > 0, entries };
}

/** Rewrite the whole document from a list of entries — one format, always, never an append-parse. */
async function write(root, entries) {
  const path = join(root, RECEIPT_NAME);
  if (entries.length === 0) {
    // The last sort in effect has been undone: the folder is a heap again, and the receipt must
    // stop claiming otherwise. Removing it is what keeps rule (2) above true.
    await rm(path, { force: true });
    return { path, exists: false, entries: [] };
  }
  const body = HEADER.join('\n') + entries.map(renderEntry).join('\n');
  await writeFile(path, body, 'utf8');
  return { path, exists: true, entries };
}

/**
 * Record a sort that has just happened. Newest first — a person opening this wants to know what
 * the program did to their photographs most recently, not what it did a year ago.
 *
 * @param {string} root
 * @param {{runId: string, moved: number, now?: Date}} run
 */
export async function recordSort(root, { runId, moved, now = new Date() }) {
  const { entries } = await readReceipt(root);
  const fresh = { runId, when: whenInWords(now), moved };
  return write(root, [fresh, ...entries.filter((e) => e.runId !== runId)]);
}

/**
 * Forget a sort that has been undone. Silent when the run is not in the document: rollback is
 * idempotent by design, so undoing twice must not be an error here either.
 */
export async function forgetSort(root, runId) {
  const { entries } = await readReceipt(root);
  return write(root, entries.filter((e) => e.runId !== runId));
}
