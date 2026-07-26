# Bug 02 — a Samsung gallery ID is read as a unix epoch, misdating a photo by 23 years

**Status:** ✅ DONE (2026-07-26)
**Version/build:** `main` @ Phase 5 · **When/context:** found on the FIRST run against a real-archive
sample (`D:\work\ai_sandbox\KPOT_SAMPLE`, 3397 files) — the run the whole sample was made for.

## Symptom

A photo the owner keeps in his own `2024/` folder is planned into `2001/Осень/`:

```
2024/1000018552.jpg
    -> 2001/Осень/1000018552.jpg
    dated 2001-09-09T06:55:52.000Z (filename-epoch)
```

`1000018552` is a **Samsung gallery sequence number**, not a timestamp. Read as epoch seconds it
lands on 2001-09-09, which is exactly the band `10000xxxxx` maps to.

Scale on the sample: 1 of 37 epoch decodes. The other 36 were correct, so the detector is sound —
this is a narrow false-positive class, not a broken feature. But it is the worst KIND of wrong: a
confident, plausible-looking date that overrides the owner's own filing and moves a 2024 photo into
a year he has no photos in.

## Repro (deterministic)

```js
import { bestNameEvidence } from './src/meta/filename_date.mjs';
bestNameEvidence('1000018552.jpg', { now: new Date('2026-07-26') });
// before the fix: filename-epoch, instant 2001-09-09T06:55:52.000Z
// after:          null — no date claimed from the name
```

## Root cause

`epochInstant()` sanity-checks the decoded year against `EPOCH_MIN_YEAR = 2000`. The bound was
chosen as "the digital-photo era", which is right for EXIF but wrong for this evidence kind.

The decisive argument is about the CONVENTION, not the photo: epoch-in-filename is produced by
Android and by messengers. Android 1.0 shipped in **September 2008**. A filename-epoch claim that
decodes to 2001 therefore contradicts itself — the naming convention did not exist on the date it
claims — so it is evidence of a non-epoch identifier, not evidence of a 2001 photograph.

Sequential IDs are indistinguishable from epochs by shape alone (both are 10 digits in a plausible
range), so no amount of regex tightening finds this. The self-contradiction is the only signal that
does not require guessing.

## The fix

`EPOCH_MIN_YEAR: 2000 → 2008`, with the reasoning recorded at the constant. Verified against the
real sample: the earliest legitimate epoch decode there is **2011-08-04**, so no correct decode is
affected — only the fabricated one disappears.

## Decisions made without the owner

1. **The bound is 2008, the year the convention began**, rather than a corpus-derived threshold. A
   corpus check ("this archive has no other 2001 photos") was considered and rejected as the primary
   rule: it would make one file's date depend on the rest of the collection, which is exactly the
   kind of non-local, hard-to-explain behaviour `GOAL.md` asks KPOT to avoid. The self-contradiction
   argument is local, explainable in one sentence, and needs no corpus.
2. **A rejected epoch claim yields NO date from the name**, rather than falling through to a weaker
   reading of the digits. The file then relies on EXIF, the directory, or lands in `ПРОЧЕЕ` — honest
   about not knowing, per invariant 3.

## Related observation, NOT fixed (owner's call)

The same run produced `2000/Зима начало года/…` for a file whose EXIF `DateTimeOriginal` reads
`2000-01-01 00:25:13`. A date of 1 January at ~00:00 is the classic reset-camera-clock default, and
the archive otherwise starts in 2007. Distrusting such EXIF values is a policy decision about the
owner's photos, not a defect — surfaced in `STATUS.md` rather than decided here.

## Links

- `researches/02_real_archive_survey.md` §Filename patterns — 7 895 files carry unix-timestamp-like
  names; that count evidently includes sequential IDs as well as true epochs.
- `tests/meta_filename_date.test.mjs` — the guard.
