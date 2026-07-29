// src/core/words.mjs — Russian words for numbers and dates, in the forms a person writes them.
// [TESTED: 2026-07-29 · tests/words.test.mjs — the plural rule across 0…1000 including the teens
// and the -1/-2/-3 endings, and dates on both claim shapes; break-verified]
//
// Phase 6.6 (plans/03 §Фаза 6.6). The owner's language requirement is a PRODUCT requirement, and
// its acceptance is «проверка — чтением, а не грепом» — which is exactly how these were found:
// the pre-sort plan told him «Дубликаты: 1 групп, 2 копий в сторону» and «Ждут вашего решения:
// 1 папок». No banned word, perfectly greppable-clean, and wrong Russian in the first three lines
// of the document the whole product is built around.
//
// It lives in `src/core/` because `src/plan/` and `src/apply/` both render owner-facing reports and
// are SIBLINGS — a fact two layers need moves down (RULE 2), the same reason `RUNS_DIR_NAME` and
// `INBOX_DIR` are here.

/**
 * Pick the Russian form that agrees with a count.
 *
 * The rule is not "one vs many": Russian has three forms, chosen by the last digit EXCEPT in the
 * teens, where everything takes the third. 1 файл · 2 файла · 5 файлов · 11 файлов · 21 файл.
 *
 * @param {number} n
 * @param {string} one   the form for 1  («файл»)
 * @param {string} few   the form for 2–4  («файла»)
 * @param {string} many  the form for 5–20 and 0  («файлов»)
 * @returns {string} the form alone — callers put the number where they need it
 */
export function plural(n, one, few, many) {
  const abs = Math.abs(Math.trunc(n));
  const lastTwo = abs % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return many;   // одиннадцать … четырнадцать
  const last = abs % 10;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

/** `5 файлов` — the count and its agreeing noun, which is what a sentence actually needs. */
export const counted = (n, one, few, many) => `${n} ${plural(n, one, few, many)}`;

const MONTHS_GENITIVE = Object.freeze(['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']);

/**
 * A date the way a person writes one: «15 июня 2012, 10:11».
 *
 * Takes the verdict's wall-clock string when there is one, and otherwise reads the UTC instant as
 * UTC — the same deterministic choice the bucketing makes, and for the same reason (the machine's
 * local zone would sort one archive differently on two computers).
 *
 * A midnight time is dropped rather than printed as «00:00», which reads as a claim about the hour
 * that no year-only source ever made.
 *
 * @param {{date?: string, instant?: string|number}} verdict
 * @returns {string}
 */
export function dateInWords(verdict) {
  let year, month, day, hh, mm;
  if (verdict.date) {
    // 'YYYY-MM-DD HH:MM:SS' — the local wall clock exactly as the camera or the filename wrote it
    year = Number(verdict.date.slice(0, 4));
    month = Number(verdict.date.slice(5, 7));
    day = Number(verdict.date.slice(8, 10));
    hh = verdict.date.slice(11, 13);
    mm = verdict.date.slice(14, 16);
  } else {
    const d = new Date(verdict.instant);
    year = d.getUTCFullYear();
    month = d.getUTCMonth() + 1;
    day = d.getUTCDate();
    hh = String(d.getUTCHours()).padStart(2, '0');
    mm = String(d.getUTCMinutes()).padStart(2, '0');
  }
  const dayPart = `${day} ${MONTHS_GENITIVE[month - 1]} ${year}`;
  return (hh === '00' && mm === '00') ? dayPart : `${dayPart}, ${hh}:${mm}`;
}

/**
 * `2012-05-01 10:00:00` → «1 мая 2012, 10:00», for a bare wall-clock string that is not a verdict.
 * The inherited-dates section had been printing the raw form at the owner while the move lines two
 * screens up printed the readable one — one product, two ways of writing a date.
 */
export const wallInWords = (wall) => (typeof wall === 'string' && wall.length >= 16
  ? dateInWords({ date: wall })
  : String(wall ?? ''));
