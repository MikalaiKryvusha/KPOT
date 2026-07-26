// src/core/decisions.mjs — the owner's per-folder decisions, in a file they can actually edit.
// [TESTED: 2026-07-26 · tests/suspicious_dirs.test.mjs — sloppy spacing and synonyms accepted,
// unreadable answers reported rather than guessed, answers preserved when the file is regenerated,
// a missing file treated as "nothing decided". The last two verified by breaking them]
//
// Owner's choice, 2026-07-26: a plain decisions file, over terminal prompts and over marker files
// inside the folders. The reasons it wins are worth recording, because they constrain the format:
//   · decisions SURVIVE between runs — a 71 606-file archive is not approved in one sitting;
//   · it works for a non-technical reader — the file explains itself, in Russian, at the top;
//   · it is the future GUI's data model unchanged (`ideas/02`), so the GUI is a renderer over this
//     file rather than a second source of truth.
//
// Format — deliberately the dullest thing that works:
//
//     скриншоты = как есть
//     Разное    = сортировать
//     фото 2011 =
//
// One folder per line, `путь = решение`. Everything after `#` is a comment. An empty or unrecognized
// value means UNDECIDED, and undecided means untouched — never a default guess (PHILOSOPHY §three
// doors). Parsing is forgiving because a human types this: case, spacing and a few obvious synonyms
// all pass, and anything else is reported back rather than silently interpreted.
//
// Layering: it lives in `src/core/` beside `journal.mjs` and `scan_cache.mjs` — KPOT's own files,
// readable by any layer. It never touches a file of the user's archive.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { RUNS_DIR_NAME } from './paths.mjs';

/** The decisions file's name. Russian, because the owner opens it by hand. */
export const DECISIONS_NAME = 'папки-на-согласование.txt';

/**
 * The two words the owner writes. They live HERE rather than in `src/plan/suspicious.mjs` because
 * they are part of this file's format, and RULE 2 forbids `core/` from importing anything above it.
 */
export const DECISION_SORT = 'сортировать';
export const DECISION_AS_IS = 'как есть';

/** Full path of a tree's decisions file. */
export const decisionsPathFor = (root) => join(root, RUNS_DIR_NAME, DECISIONS_NAME);

/** Accepted spellings, so a human's answer is not rejected on a technicality. */
const SORT_WORDS = new Set([DECISION_SORT, 'сортировать', 'сортируй', 'разобрать', 'да', 'sort', 'yes', '+']);
const AS_IS_WORDS = new Set([DECISION_AS_IS, 'как есть', 'какесть', 'оставить', 'оставь', 'не трогать', 'нет', 'asis', 'as-is', 'keep', 'no', '-']);

/**
 * Read the owner's decisions.
 *
 * Never throws: a missing file means "nothing decided yet", which is the correct state for a first
 * run and must not look like an error.
 *
 * @param {string} root
 * @returns {Promise<{decisions: Map<string, 'sort'|'as-is'>, unreadable: Array<{line: number, text: string}>, path: string}>}
 */
export async function loadDecisions(root) {
  const path = decisionsPathFor(root);
  const decisions = new Map();
  const unreadable = [];
  let raw;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    return { decisions, unreadable, path };
  }

  for (const [i, rawLine] of raw.split(/\r?\n/).entries()) {
    const line = rawLine.split('#')[0].trim();
    if (line === '') continue;
    const eq = line.indexOf('=');
    if (eq === -1) { unreadable.push({ line: i + 1, text: rawLine }); continue; }
    const dir = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().toLowerCase();
    if (dir === '') { unreadable.push({ line: i + 1, text: rawLine }); continue; }
    if (value === '') continue;                      // written but not answered — still undecided
    if (SORT_WORDS.has(value)) decisions.set(dir, 'sort');
    else if (AS_IS_WORDS.has(value)) decisions.set(dir, 'as-is');
    else unreadable.push({ line: i + 1, text: rawLine });   // report it; never guess what was meant
  }
  return { decisions, unreadable, path };
}

/**
 * Write (or refresh) the decisions file for a set of suspicious folders.
 *
 * Answers already given are PRESERVED — the file is regenerated on every plan, and losing the
 * owner's work because the tool re-ran would make the whole mechanism useless. Folders that no
 * longer exist drop out; new ones appear unanswered at the end of the list.
 *
 * @param {string} root
 * @param {Array<{dir: string, reason: string, files: number}>} suspicious
 * @param {Map<string, 'sort'|'as-is'>} existing  from loadDecisions
 * @returns {Promise<{path: string, pending: number}>}
 */
export async function saveDecisions(root, suspicious, existing = new Map()) {
  const path = decisionsPathFor(root);
  await mkdir(dirname(path), { recursive: true });

  const answered = (dir) => (existing.get(dir) === 'sort' ? DECISION_SORT
    : existing.get(dir) === 'as-is' ? DECISION_AS_IS : '');
  const width = Math.max(0, ...suspicious.map((s) => s.dir.length));
  const pending = suspicious.filter((s) => !existing.has(s.dir)).length;

  const L = [
    '# KPOT — ПАПКИ, ПО КОТОРЫМ НУЖНО ВАШЕ РЕШЕНИЕ',
    '#',
    '# У этих папок непонятные названия: по ним нельзя понять, ваши это папки или их создала',
    '# программа. Пока вы не решите — KPOT их НЕ ТРОГАЕТ, файлы внутри остаются на месте.',
    '#',
    '# Напишите после знака = одно из двух:',
    `#     ${DECISION_SORT}  — разобрать файлы внутри по годам и порам года, как всё остальное`,
    `#     ${DECISION_AS_IS}     — не трогать эту папку, пусть остаётся как есть`,
    '#',
    '# Потом просто запустите KPOT снова. Ваши ответы сохраняются.',
    '',
  ];
  for (const s of suspicious) {
    L.push(`# ${s.reason}; медиафайлов внутри: ${s.files}`);
    L.push(`${s.dir.padEnd(width)} = ${answered(s.dir)}`.trimEnd());
    L.push('');
  }
  if (suspicious.length === 0) L.push('# (сейчас таких папок нет — решать нечего)');

  await writeFile(path, L.join('\n') + '\n', 'utf8');
  return { path, pending };
}
