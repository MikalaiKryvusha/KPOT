# Bug 03 — a file already home under a differently-CASED folder was planned to move onto itself

**Status:** ✅ DONE (2026-07-26)
**Version/build:** `main` @ Phase 5 · **When/context:** found by the **dry run** during the first
supervised sort of the real-archive sample — the rehearsal doing exactly the job it exists for.

## Symptom

`apply --dry-run` reported **15 failed** operations before anything had been touched:

```
target already exists — the tree changed since the plan was built
  2025/Зима Конец Года/IMG20251207161650.jpg
  2025/Зима Начало Года/Посиделки с Хлопцами/IMG_20250223_144148_049.jpg
  2026/Зима Начало Года/IMG20260110000827.jpg
  … 15 in total
```

## Root cause

The owner capitalises his season folders — `2025/Зима Конец Года/` — where KPOT's canonical name is
`Зима конец года`. **On Windows those are the same directory.** The file was already exactly where
the plan wanted it.

`buildPlan` filtered out no-op operations with `o.from !== o.to`: a raw string comparison. The two
paths differ as strings, so the move survived the filter; at execution `apply` checked the real
filesystem, found the target occupied (by the file itself) and correctly refused.

`AGENT_GUIDE.md` §Code style mandates the fix in advance — «Compare paths with a normalizing helper
in `src/core/`, not `===`» — and `src/core/paths.mjs` has provided `samePath()` (win32 semantics,
case-folded, tested) since Phase 1. The rule existed; this one call site did not follow it.

## The fix

`buildPlan`: `o.from !== o.to` → `!samePath(o.from, o.to)`. One line, using the existing helper.
Re-run on the real sample: **15 failed → 0 failed.**

## Why it mattered more than 15 noisy lines

The same 15 operations would have been re-planned on every future run — the archive would never
have reached a fixed point, contradicting invariant 11 (sorting is idempotent) for every folder the
owner had capitalised differently. Real archives are full of such folders.

## Decisions made without the owner

1. **KPOT does not rename the owner's folder to match its own spelling.** `Зима Конец Года` stays
   as he wrote it; the file is simply recognised as already home. Renaming would tidy the library's
   casing at the cost of overwriting a name the owner chose — invariant 6 says the user's names
   survive, and cosmetic consistency is not worth breaking it. Consequence, accepted and visible:
   a library can contain both spellings of a season.
2. **Case-insensitive comparison is the default**, matching `paths.mjs`'s project-wide decision for
   a Windows target. On a case-sensitive filesystem such a file would be moved instead — correct
   there, and consistent with the helper's documented behaviour.

## Links

- `researches/03_first_real_run.md` — the run that found it.
- `tests/idempotence.test.mjs` — the guard, next to the other idempotence specs.
