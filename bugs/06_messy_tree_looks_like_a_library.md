# Bug 06 — a messy folder with one `2013/` in it is taken for a finished library, and the wizard is skipped

**Status:** 🔧 OPEN (found 2026-07-29)
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

## Guard

A spec that points `libraryShape()` at the messy fixture and asserts `isLibrary === false`, plus one
that asserts a genuinely sorted tree is still recognised. Both must be verified by breaking the fix.

## Decisions made without the owner

*(filled in when the bug is closed)*

## Links

- `src/ui/folders.mjs` — `libraryShape()`, and the comment this bug contradicts.
- `interviews/interview_003_interface.md` Q1 — the owner's two-screen decision («Пока библиотека не
  собрана, человека ведут по шагам»), which this defeats on his own archive.
- `researches/02_real_archive_survey.md` §Directory structure — the hand-made year/season folders.
