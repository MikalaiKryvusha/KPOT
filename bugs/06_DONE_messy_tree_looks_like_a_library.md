# Bug 06 — a messy folder with one `2013/` in it is taken for a finished library, and the wizard is skipped

**Status:** ✅ DONE (found and fixed 2026-07-29, commit `d7ef914`) — fixed by the OWNER's rule, not
by any of the four options below. He replaced the question itself: «KPOT должен оставлять
документ-расписку. Его нет — считаем, что беспорядок. Он есть — видим в нём историю сортировок.»
**Version/build:** `main` @ phase 6.6 — present since `libraryShape()` landed in 6.3 · **When/context:**
found while driving the WIZARD in a headless browser for the language pass. The tree handed to it was
the project's own messy fixture; the program showed the **control panel** instead.

## Symptom

`node tests/fixtures/make.mjs <dir>` produces a deliberately chaotic tree — device dumps, messenger
downloads, duplicates, junk, nothing sorted. Pointing the interface at it:

```
--- WIZARD, PLAN SCREEN (expected) ---
Ваша библиотека
Всё уже разложено. Отсюда можно запустить любой прогон заново…
По годам
  📁 2014 — Открыть
  📁 2013 — Открыть
Что вы уже запускали
  Пока ничего не запускалось.
```

The panel says «Всё уже разложено» about a folder where nothing has ever been sorted, and — the
line that gives it away — «Пока ничего не запускалось» two blocks below. The two statements
contradict each other on one screen.

## Root cause

`libraryShape()` in `src/ui/folders.mjs` decides with:

```js
const years = dirs.filter((n) => YEAR_DIR_RE.test(n));      // /^(19|20)\d{2}$/
const hasGlobalOther = dirs.some((n) => n === 'ПРОЧЕЕ');
return { isLibrary: years.length > 0 || hasGlobalOther, years };
```

**Any** top-level directory named like a year makes the folder a library. The fixture has `2013/`
(the owner's hand-made season subtree, planted precisely because his real archive has them).

The module's own comment states the intended trade and is wrong about which way it fails:

> Being wrong in the cautious direction (showing the wizard to someone who has a library) merely
> repeats four questions; being wrong the other way would drop a first-time user into a control
> panel for a library that does not exist.

That is exactly what happens. The test is not cautious — it is the permissive one.

## Why it matters more than a wrong screen

`researches/02_real_archive_survey.md` recorded that the owner's real 551 GB archive **already
contains hand-made `<year>/<season>` directories**, including one spelled «осень». So on his own
archive, on the very first run:

- the wizard — the whole point of interview #003's two-screen design, and the thing built for a
  person «который боится сломать» — **never appears**;
- he is shown «Всё уже разложено» about an archive that is not;
- the panel's «Разложить новое» offers to top up a library that does not exist yet.

Nothing is destroyed and nothing is at risk: every run behind the panel is the same guarded run.
The damage is that the product's first impression is a false statement about the person's files.

## Candidate fixes (not decided — this needs thinking, not a reflex)

1. **Require KPOT's own shape, not just a year:** a year directory containing one of *our* canonical
   season names. Weak against bug 03's case-only differences — the owner's `2025/Зима Конец Года/`
   would still match, and it is his, not ours.
2. **Require a run history** (`.kpot-runs/` with at least one finished run). Precise — it means "we
   sorted this" rather than "this looks tidy" — but a person who deletes `.kpot-runs` loses the
   panel.
3. **Both, as a rule:** panel if a run history exists, OR if a year directory holds a season
   directory AND there is no obvious unsorted material at the root.
4. **Ask instead of guessing** — one line at the top of the panel: «Похоже, здесь уже есть порядок.
   Начать с начала?» That is invariant 10 applied to a UI decision, and it is the cheapest.

Recommendation to start from: **2 + 4**. A run history is what "we have sorted this" actually means,
and where the guess is still needed, the product's own rule is to ask rather than decide.

## The fix — the owner's, and better than all four

He did not pick from the list. He changed what the program asks:

> **KPOT должен оставлять документ-расписку. Его нет — считаем, что беспорядок. Он есть — видим в
> нём историю сортировок.**

`src/core/receipt.mjs` — a plain readable document in the archive root («KPOT — что здесь
сделано.txt») listing the sorts that are **still in effect**: when, how many files, and the command
to undo each. Written by a real run that moved something; an undone run is removed from it, and when
the last entry goes the document goes too. `libraryShape()` asks the receipt.

Why this beats every option above: those all try to infer the past from the present, and differ only
in how cleverly. A receipt does not infer — the program wrote down what it did. Three consequences
fall out for free:

- it fails **safe by construction**: no document, no claim, so the wizard is the default;
- **the person can read it** and can delete it, and its own text says so — the transparency the
  product is built on, applied to the product's own state;
- **an undone sort stops counting**, which closes the same bug by its other door: after a full
  rollback the tree really is a heap again.

Parsed by **run id**, never by wording — `run-20260729-141204-22687e` is a machine token, and phase
6.6 had just spent a day rewriting the prose around it.

## Guard

`tests/ui_folders.test.mjs`, and the two specs that asserted the OLD rule now assert its opposite on
the same fixtures — which is the fix itself:

- *YEAR FOLDERS ARE NOT PROOF OF ANYTHING* — hand-made `2011/2013/2014/Лето` plus a `ПРОЧЕЕ` bucket,
  no receipt: `isLibrary === false`, and the years are still listed (that IS a question about the
  folder);
- *THE RECEIPT IS WHAT MAKES IT A LIBRARY* — the document's whole life: written, deleted by hand
  (must fail safe), and removed by an undo.

**Break-verified:** restoring the old rule (`isLibrary: years.length > 0`) turns **both red**.

`tests/receipt.test.mjs` (added 2026-07-29, after the first fix commit) covers the document itself
and the wiring, because both `[TESTED]` markers named that file while it did not yet exist. Eight
specs, six breaks planted one at a time, each turning red only its own spec: a rehearsal leaves
nothing · a real sort writes it and a no-op run adds no line · the parser survives a total rewrite
of the prose around the run ids · a damaged document fails safe · an emptied one is deleted · a
re-recorded run never duplicates · the scan never lists it. Suite **286 → 294**.

### A correction, and a trap for the next session

The fix commit's message says *"six census helpers now skip `RECEIPT_NAME`"*. **That is wrong —
only two do** (`apply_phase4`, `inbox_topup`), the two whose specs actually failed. Do **not**
"finish the job":

> **`tests/ui_undo.test.mjs`'s census must keep counting the receipt.** It is the only guard on the
> rollback half — remove `forgetSort` from `src/apply/rollback.mjs` and that census goes red at
> :250 because the orphaned document shows up as an extra row. Teaching it to skip `RECEIPT_NAME`
> would delete that guard silently, while every test stayed green.

`idempotence` and `resume` pass for a real reason too (a second sort moves nothing, so nothing is
rewritten). An exclusion in a census is guard-shaped: it belongs where a spec needs it, with a
comment saying why, never applied as a sweep. Lesson captured as **EXP-0025**.

## Verified by LOOKING, which is how this bug was found

The bug was invisible to 283 green specs and visible in one second on a rendered page (EXP-0024), so
its acceptance was taken the same way: headless Edge over CDP, clicking through the real folder
chooser, reading what the person is actually told (scratchpad `bug06_look.mjs`). Tree used is the
owner's archive shape — a hand-made `2013/Лето/` beside loose unsorted photographs:

| State of the folder | What the person is shown |
|---------------------|--------------------------|
| heap with a hand-made `2013/` | **МАСТЕР** — «Наведём порядок…», the four steps, the plan. *This is the bug, gone* |
| after a real sort (2 files moved) | **ПУЛЬТ** — «Всё уже разложено», three run cards, the run history |
| after the undo (2 restored) | **МАСТЕР** again — the receipt went with the sort |

The third row is the one worth keeping: it proves the bug does not return by its other door.

## Decisions made without the owner

1. **The receipt lists sorts that are still IN EFFECT, not everything that ever happened.** His words
   were «видим в нём историю сортировок»; a history that keeps describing an undone run would make
   the document lie about the folder it sits in, and would re-open this very bug after a rollback.
   The complete history is still on disk in `.kpot-runs/` and in the panel's run list.
2. **The document is excluded from the scan.** Otherwise the plan would list KPOT's own paperwork
   under «остаётся на месте», among his photographs.
3. **Writing it is best-effort and happens after the files are home.** It is a courtesy to the
   reader, not a link in the safety chain, and it must never cost a run that succeeded.
4. **Only a real run that MOVED something is recorded** — a rehearsal moved nothing, and a run with
   nothing to move has nothing to undo; neither makes a folder a sorted library.
5. **The file name is visible and Russian** (`KPOT — что здесь сделано.txt`) rather than hidden or
   dot-prefixed: a person meeting it among their own folders should be able to tell what it is, and
   the panel's whole premise is that the program explains itself.

## Links

- `src/ui/folders.mjs` — `libraryShape()`, and the comment this bug contradicts.
- `interviews/interview_003_interface.md` Q1 — the owner's two-screen decision («Пока библиотека не
  собрана, человека ведут по шагам»), which this defeats on his own archive.
- `researches/02_real_archive_survey.md` §Directory structure — the hand-made year/season folders.
