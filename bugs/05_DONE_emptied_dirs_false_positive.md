# Bug 05 — the plan announces the whole library as «папки, которые опустеют и будут удалены»

**Status:** ✅ DONE (found and fixed 2026-07-29, commit `abac68a`)
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

`emptiedDirs()` was given the third population. `buildPlan` already computed it — the operations
dropped by the `samePath` filter — so instead of only counting them they are kept as a list and each
one's ORIGINAL path is `keep()`-ed: a file that is already home keeps its folder alive for exactly
the same reason a file that stays does. `op.from`, not `op.to`, because `from` is how the folder is
actually spelled on disk and that is what the directory listing being filtered contains.

**After the fix, re-measured on the same shapes:**

| | before | after |
|---|---|---|
| folders a sorted library announces for deletion (at 0 operations) | 48 | **0** |
| rehearsal vs real run, folders removed, on a top-up | 48 vs 1 | **1 vs 1** |

A second change rode along and is deliberately marked as NOT guarded: directory membership is now
compared with `normalizeForCompare` rather than raw string equality, because `AGENT_GUIDE` §Code
style mandates the helper for exactly this comparison and bug 03 was the same mistake one level
down. No spec falsifies it — every case it would catch is already covered by another survivor entry
— and that is written into the code comment instead of being implied by its presence.

## Guard

`tests/empty_dirs.test.mjs`, two new specs, both verified by breaking the fix first:

- *A SORTED LIBRARY HAS NO FOLDERS WAITING TO BE DELETED* — plans the tree KPOT itself produced and
  asserts `operations`, `emptied` and `counts.emptiedDirs` are all empty, plus the absence of the
  section in the rendered report;
- *THE REHEARSAL AND THE REAL RUN REMOVE THE SAME FOLDERS* — two identical trees, both sorted first
  so the triggering population exists, then one rehearsed and one run for real; `dirsRemoved` must
  match. This is the `GOAL.md` §в promise as an assertion.

**Break-verification:** disabling the one added line turns **3 specs red** (the two above, plus the
phase-6.4 idempotence criterion). Note the shape of the pre-existing coverage and why six specs
missed this: every one of them starts from an UNSORTED fixture, where the population that triggers
the bug does not exist.

## Decisions made without the owner

1. **Fixed inside phase 6.4 rather than deferred to its own session.** It was found while measuring
   the inbox, it lives in the very function the phase had to change (`emptiedDirs`), and leaving a
   known false deletion-warning in place while adding a feature that depends on that same list would
   have been the worse trade. The commit names both halves so the history stays separable.
2. **The report keeps its wording.** The heading «ПАПКИ, КОТОРЫЕ ОПУСТЕЮТ И БУДУТ УДАЛЕНЫ» and its
   explanatory lines are unchanged — the text was never wrong, the list was. Rewriting owner-facing
   wording to soften a defect instead of fixing the defect is how a report stops being trusted.
3. **The path-normalisation hardening was kept despite having no guard**, and labelled as such in
   the code. The alternative — removing it to avoid an unfalsifiable line — would leave a comparison
   the project's own code style forbids.
4. **No behaviour of `apply` was touched.** The readdir + rmdir chain is what kept this from ever
   costing a file, and it was verified as holding rather than adjusted. A defect in an artifact is
   fixed in the artifact.

## Links

- `plans/08_novoe_topup.md` §3 place 4 — the phase that found it; the inbox's own protection from
  deletion is a separate rule that survives this fix.
- `bugs/01_DONE_sort_not_idempotent.md` — the same family: KPOT reasoning wrongly about its own
  output. EXP-0010 asks `f(f(x)) == f(x)?` of any transform; that question was asked of the
  operations list and never of the artifact's other sections.
- Probes: scratchpad `emptied_probe.mjs` and `dryrun_divergence.mjs` (session 2026-07-29).
