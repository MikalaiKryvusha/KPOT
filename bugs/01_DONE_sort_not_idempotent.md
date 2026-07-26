# Bug 01 — the sort is not idempotent: KPOT does not recognize its own output layout

**Status:** ✅ DONE (2026-07-26)
**Version/build:** `main` @ Phase 4 + scan cache (2026-07-26) · **When/context:** found during the
Phase-5 scan-cache smoke run — a second `plan` on an already-sorted tree still wanted 13 moves.

## Symptom

Running `apply` on a tree and then planning again does **not** produce an empty plan. On the fixture
tree the second plan wants to move 13 of 26 files, in three distinct shapes:

```
2014/Зима начало года/Мобилка/IMG_20140121_183801.jpg
   -> 2014/Зима начало года/Зима начало года/Мобилка/IMG_20140121_183801.jpg

ПРОЧЕЕ/_дубликаты/копии__DSC02000.JPG
   -> ПРОЧЕЕ/_дубликаты/ПРОЧЕЕ___дубликаты__копии__DSC02000.JPG

2013/Осень/день рождения.jpg
   -> 2013/прочее/день рождения.jpg
```

Expected: a second run is a no-op. `researches/02_real_archive_survey.md` §Directory structure states
the requirement explicitly — «the tool must recognize an already-sorted subtree, merge into it
**idempotently**».

**Why this is severe rather than cosmetic.** It is not a tidiness issue:
1. Each run nests one level deeper (`Зима начало года/Зима начало года/…`) and lengthens the
   quarantine names by their whole path — unbounded growth, and on Windows a path that grows toward
   the 260-char limit on every run.
2. The third shape **loses information**: a file correctly shelved in `2013/Осень` is demoted to
   `2013/прочее`. The library degrades with use.
3. It lands on the owner's real archive immediately, because that archive is *already* hand-sorted
   into `<year>/<season>` dirs (researches/02: year dirs 2007–2026 with season dirs inside). The very
   first real run starts in the state this bug mishandles.

## Repro (deterministic)

```bash
node tests/fixtures/make.mjs <tmp>
node bin/kpot.mjs apply <tmp>            # first sort — correct
node bin/kpot.mjs plan <tmp> --json      # expect 0 operations; actually 13
```

## Root cause

**One cause, three faces: KPOT's own output vocabulary is invisible to the modules that read a path.**
Both were written against the *owner's* hand-made directories (`Лето 2013`, `осень_2013`) and never
against KPOT's own canonical output (`2013/Лето/`, `2013/прочее/`, `ПРОЧЕЕ/_дубликаты/`).

1. **`src/plan/bucket.mjs` → `isDateStructureDir()`** strips year and season *tokens* and asks whether
   anything is left. For the canonical winter names there is:
   `«Зима начало года»` → remove `зима` → `начало года` → `началогода` ≠ `''` → **treated as one of
   the owner's own folders** and re-nested inside itself. `прочее`, `ПРОЧЕЕ`, `_мусор` and
   `_дубликаты` are not in `TECHNICAL_DIR_NAMES` either, so they re-nest the same way.
2. **`src/plan/bucket.mjs` → `planBucket()`** builds the quarantine name as
   `asset.path.split('/').join('__')` unconditionally. For a file that is *already* quarantined the
   provenance prefix is applied a second time on top of the first.
3. **`src/meta/dirname_date.mjs` → `dirnameEvidence()`** only inspects the innermost segment that
   contains a **year**. KPOT's own layout splits the two facts across two segments (`2013/` and
   `Осень/`), so the season is never read: the loop skips `Осень` (no year), settles on `2013`, and
   returns year-only evidence → a *partial* verdict → `<год>/прочее`.

Note the asymmetry that hid this: the owner's format `осень 2013` carries year **and** season in one
segment, which is exactly what the extractor was built and tested against. KPOT's own format does not.

## Fix plan

1. `bucket.mjs`: an explicit set of KPOT's OWN layout directory names, derived from the existing
   constants (`SEASONS`, `YEAR_OTHER`, `GLOBAL_OTHER`, `JUNK_DIR`, `DUPES_DIR`) rather than retyped,
   so it cannot drift from the layout it describes. Treat them as structural, like year dirs.
2. `bucket.mjs`: a file already inside a quarantine directory keeps its name — the provenance is
   already in it.
3. `dirname_date.mjs`: having found the innermost year-bearing segment, look for a season word in
   that segment **and any segment below it**, so `2013/Осень/` reads as year + season.
4. Guard the class, not the instances: a spec asserting that a second plan after an apply has **zero**
   operations, and an apply→apply→rollback→rollback cycle that still returns the tree byte-for-byte.

## ✅ STATUS: DONE (2026-07-26)

All three causes fixed; `plan` after `apply` now reports **0 moves**, and a third pass changes
nothing. Guards: `tests/idempotence.test.mjs` (6 specs) — one asserting the CLASS ("a second plan is
empty", which stays valid for any future bucket rule) plus one per cause. **Each fix was reverted
individually and the guard went red every time**, so the specs are known to catch this bug and not
merely to accompany it. Suite 98 → 104.

`TWINS: searched for the same defect class — (a) any other place flattening a path into a name
(`grep "join('__')\|split('/').join"` → 1 site, the fixed one), (b) any module hardcoding a bucket
name instead of importing the constant (→ none; only `season.mjs` and `bucket.mjs` own those
strings), (c) the other 8 modules that split paths — reviewed: `apply/`, `backup/`, `rollback/` treat
segments as opaque, `dedupe` ranks by depth only, `cohort` groups by parent dir and stays
self-consistent after a sort (empirically: run 2 = 0 moves). No further sites.`

## Decisions made without the owner

1. **`прочее` / `ПРОЧЕЕ` / `_мусор` / `_дубликаты` are now treated as technical directories**, i.e.
   an owner folder that happens to be named `прочее` would be absorbed into KPOT's bucket of the
   same name rather than preserved as nesting. Chosen because it is the same semantic shelf and
   because the alternative re-nests forever; it also matches the spirit of the 2026-07-26 decision
   ("all except technical"). Cheap to reverse — one entry in `OWN_LAYOUT_DIRS`.
2. **The season may now be read from a directory below the year directory** (`2013/Осень/`). This
   slightly widens dirname evidence beyond what interview #001 discussed. Guarded so it cannot
   over-reach: a segment naming a *different* year is never crossed.
3. **The quarantine name is frozen on first quarantine.** A file re-quarantined later keeps the
   provenance recorded the first time, rather than accumulating each intermediate location. The
   first location is the one that means something to the owner.
4. **Not decided, deliberately left alone:** `TECHNICAL_DIR_NAMES` contains the English device-folder
   names (`screenshots`, `downloads`, `camera`) but not their Russian equivalents (`скриншоты`,
   `камера`), so the fixture's `скриншоты/` survives as a "custom" folder. Whether Russian
   device-folder names should count as technical is a *policy* question of the same kind the owner
   answered on 2026-07-26 — filed as an open question in `STATUS.md` rather than settled here.

## Links

- `researches/02_real_archive_survey.md` §Directory structure — the idempotence requirement.
- `MASTER_PLAN.md` §Decision log 2026-07-26 — "preserve all custom dirs EXCEPT technical ones".
  This fix does not change that decision; it makes KPOT's own directories count as technical, which
  is what the decision already intended (it lists "pure year/season dirs").
- `ideas/01_inbox_topup_flow.md` — the top-up flow is built on idempotent merging; it cannot work
  until this is fixed.
