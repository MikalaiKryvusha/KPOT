# Bug 05 — the plan announces the whole library as «папки, которые опустеют и будут удалены»

**Status:** 🔧 OPEN (found 2026-07-29)
**Version/build:** `main` @ release `v0.1` — **shipped**, present since empty-folder removal landed
2026-07-26 · **When/context:** found while measuring the inbox for phase 6.4 (`plans/08`), by reading
the output of a probe run for another reason (the EXP-0010 pattern again — a number that did not
match the mental model).

## Symptom

Two symptoms, one cause. Both measured on a fresh fixture, no owner data.

**(a) The pre-sort master plan contradicts itself.** On an already-sorted library, `plan` reports
**0 operations** and simultaneously lists **48 folders** under the heading the owner reads as a
warning:

```
operations on the sorted tree: 0
emptied dirs the plan announces: 48

ПАПКИ, КОТОРЫЕ ОПУСТЕЮТ И БУДУТ УДАЛЕНЫ
  Все файлы из них переедут, пустые папки убираются.
  2008/
  2008/Зима конец года/
  2008/Зима конец года/семейный архив/
  2009/
  …
```

Those folders are not empty and nothing is moving out of them:

```
2015/Осень/аудио/голосовые/  really contains: 1 entries -> AUD-20150910-WA0003.ogg
2018/Лето/видео/             really contains: 1 entries -> MOV0001.mp4
2017/Весна/скриншоты/        really contains: 1 entries -> Screenshot_2017-05-27-….png
```

**(b) The rehearsal disagrees with the real run** — the sharper half. A library plus one new
photograph in an inbox, run twice from identical starting trees:

| | `apply --dry-run` | `apply` |
|---|---|---|
| files moved | 1 | 1 |
| **folders removed** | **48** | **1** |

47 folders the rehearsal promises to delete, the real run keeps.

## Root cause

`emptiedDirs()` in `src/plan/plan.mjs` builds the set of directories that survive the sort from
exactly two sources:

```js
for (const s of stay) keep(s.path);          // a file that stays keeps its folder alive
for (const op of operations) keep(op.to);    // a destination folder is occupied by definition
```

There is a third population of files, and it is invisible to both lines: **media that is already
exactly where the plan wants it.** Such a file is filtered out of `actionable` a few lines earlier —

```js
const actionable = operations.filter((o) => !samePath(o.from, o.to));
```

— and it is not in `stay` either, because `stay` holds only non-media (`action === 'stay'`). So its
directory is counted as one nothing will be left in.

The two mechanisms are individually correct and were built four days apart: dropping no-op moves is
bug 03's fix (2026-07-26), and the emptied-folder list is the owner's empty-folder decision of the
same day. Nobody asked what a file that is already home does to the second one — and on a FIRST
sort the answer is "nothing", because there are no already-placed files yet. The defect only appears
once KPOT is run a second time over its own output, which is precisely the top-up scenario phase 6.4
exists for, and the scenario the owner will live in from now on.

## Blast radius — measured, not assumed

- **No file is lost, and none can be.** `applyPlan` does not trust the plan about emptiness: it
  re-reads each directory (`readdir`) and skips it if anything is inside, and it removes with
  `rmdir`, which physically cannot delete a non-empty directory. That chain is documented as a chain
  on purpose, and it is what held here. This bug is a defect of the ARTIFACT, not of the writer.
- **The owner's trust is the real damage.** The one document `GOAL.md` requires him to read before
  authorising anything tells him his entire library is about to be deleted. A safety report that
  cries wolf is worse than no report: the next one gets skimmed.
- **`GOAL.md` §в is violated** — «репетиция … отчёт почти идентичный реальному». The rehearsal skips
  the readdir/rmdir chain (`if (!dryRun)`) and therefore journals a removal for every directory the
  plan NAMES, while the real run removes only the ones that truly emptied. The plan's error is
  invisible in a real run and fully visible in the rehearsal — the two disagree by exactly the wrong
  entries.
- `counts.emptiedDirs` is wrong by the same amount, so the web interface's numbers inherit it.

## The fix

`emptiedDirs()` must be given the third population. `buildPlan` already computes it — the operations
dropped by the `samePath` filter — so the fix is to keep those paths instead of discarding them and
to `keep()` each one: a file that is already home keeps its folder alive for exactly the same reason
a file that stays does.

## Guard

`tests/empty_dirs.test.mjs` — a sorted tree yields an EMPTY `emptied` list, and a top-up into a
library names only the folders the top-up itself drained. Both must be verified by breaking the fix
first. Note the shape of the existing coverage and why it missed this: every empty-folder spec so
far starts from an UNSORTED fixture, where the population that triggers the bug does not exist.

## Decisions made without the owner

*(filled in when the bug is closed)*

## Links

- `plans/08_novoe_topup.md` §3 place 4 — the phase that found it; the inbox's own protection from
  deletion is a separate rule that survives this fix.
- `bugs/01_DONE_sort_not_idempotent.md` — the same family: KPOT reasoning wrongly about its own
  output. EXP-0010 asks `f(f(x)) == f(x)?` of any transform; that question was asked of the
  operations list and never of the artifact's other sections.
- Probes: scratchpad `emptied_probe.mjs` and `dryrun_divergence.mjs` (session 2026-07-29).
